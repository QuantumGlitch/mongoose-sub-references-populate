const mongoose = require('../mongoose') || require('mongoose');
const assert = require('assert');

/**
 * Process each path of the schema and each path of each subschema
 * @param {Schema} schema
 * @param {Function<String, SchemaType>} handler
 * @param {String[]} path root of the path
 */
function eachPathRecursive(schema, handler, path) {
  if (!path) path = [];

  schema.eachPath(function (pathName, schemaType) {
    path.push(pathName);

    if (schemaType.schema) eachPathRecursive(schemaType.schema, handler, path);
    else handler(path.join('.'), schemaType);

    path.pop();
  });
}

var Query = mongoose.Query,
  _exec = Query.prototype.exec;

/**
 * Registers sub refs populate on this query.
 * @param {import('mongoose').ModelPopulateOptions[]} options
 * @remark this method can only be invoked once per query.
 * @return {Query}
 */
Query.prototype.subPopulate = function (options) {
  if (this.model.schema.methods.subPopulate == null) throw new Error('Plugin was not installed');

  if (this._subPopulate) throw new Error('subPopulate was already invoked');

  if (!options) return this;

  this._subPopulate = { options: options };
  return this;
};

/**
 * Monkey-patches `exec` to add deep population hook.
 * @param op the operation to be executed.
 * @param cb the callback.
 * @return {MongoosePromise}
 */
Query.prototype.exec = function (op, cb) {
  var subPopulate = this._subPopulate;
  if (!subPopulate) return _exec.call(this, op, cb);

  const model = this.model,
    options = subPopulate.options,
    lean = this._mongooseOptions.lean;

  if (typeof op === 'function') {
    cb = op;
    op = null;
  } else cb = cb || (() => {});

  return new mongoose.Promise(
    function (resolve, reject) {
      _exec.call(this, op, function (err, docs) {
        if (err) return reject(err), cb(err);

        if (!docs) return resolve(docs), cb(null, docs);

        execute(model, docs, options, lean, function (err, docs) {
          if (err) reject(err), cb(err);
          else resolve(docs), cb(null, docs);
        });
      });
    }.bind(this)
  );
};

/**
 * Format options
 * @param {import('mongoose').ModelPopulateOptions[]|import('mongoose').ModelPopulateOptions|String[]|String} options
 * @returns {import('mongoose').ModelPopulateOptions[]}
 */
function formatOptions(options) {
  if (options instanceof Array) {
    if (options.length > 0) {
      if (typeof options[0] === 'object') return options;
      return options.map((o) => ({ path: o }));
    }
    return options;
  }

  if (typeof options === 'object') return [options];
  return [{ path: options }];
}

// Lean not supported for the moment
/**
 * @param {import('mongoose').ModelPopulateOptions[]|import('mongoose').ModelPopulateOptions|String[]|String} options
 */
function execute(model, docs, options, lean, cb) {
  options = formatOptions(options);

  let resolvedCount = 0,
    error = false;

  for (let option of options) {
    // The schema type of sub populate's path
    const localFieldSchemaType = model.schema.path(option.path);

    // Do we know who is the ref to the root document of the sub reference ?
    const localFieldBoundToSchemaType = localFieldSchemaType.options.boundTo
      ? model.schema.path(localFieldSchemaType.options.boundTo)
      : null;

    // Root is always the starting model
    const [rootRef, ...subRefRest] = localFieldSchemaType.options.subRef.split('.');
    const subPathRef = subRefRest.join('.');

    // Referenced root model
    const rootRefModel = mongoose.model(rootRef);

    // Ensure that boundTo field is referencing the same model of subRef
    if (localFieldBoundToSchemaType)
      assert.strictEqual(localFieldBoundToSchemaType.options.ref, rootRef);

    // The schema type of referenced path
    const foreignFieldSchemaType = rootRefModel.schema.path(subPathRef);

    // Is the local field referencing an array of what ?
    const arrayOfObjects = !foreignFieldSchemaType.options.type[0].type;
    const arrayOfReferences = !!foreignFieldSchemaType.options.type[0].ref;

    assert(
      arrayOfObjects || arrayOfReferences,
      'Unsupported sub-reference type. Sub-references are valid only for array of subdocuments and array of refs.'
    );

    const refIds = {};

    // Take all refIds for this option and associate them with the corresponding docs
    for (let doc of docs) {
      const refId = doc[option.path];

      if (refIds[refId]) refIds[refId].docs.push(doc);
      else refIds[refId] = { refId, docs: [doc] };
    }

    const aggregationOptions = [
      // Match the interested values
      {
        $match: localFieldBoundToSchemaType
          ? // This is the fast way
            {
              _id: {
                $in: docs.map((doc) => {
                  let ref = doc.get(localFieldSchemaType.options.boundTo);
                  return ref._id || ref;
                }),
              },
            }
          : // This is the slow way
            {
              [`${subPathRef}${arrayOfObjects ? '._id' : ''}`]: {
                $in: Object.keys(refIds).map((r) => refIds[r].refId),
              },
            },
      },

      // Unwind
      {
        $unwind: { path: `$${subPathRef}` },
      },

      ...[
        arrayOfObjects
          ? // Replace every unwinded document with the corrispective sub document
            {
              $replaceRoot: { newRoot: `$${subPathRef}` },
            }
          : // Replace every unwinded document with an object {_id: "... ref id ..."}
            { $replaceRoot: { newRoot: { _id: `$${subPathRef}` } } },
      ],

      // If we are referencing an array of refs then we need to lookup
      // to take the referenced documents
      ...(arrayOfReferences
        ? [
            // Lookup
            {
              $lookup: {
                // Get collection's name of the refs
                from: mongoose.model(foreignFieldSchemaType.options.type[0].ref).collection
                  .collectionName,
                localField: '_id',
                foreignField: '_id',
                as: 'lookupOne',
              },
            },
            // Extract only the interested data
            {
              $unwind: '$lookupOne',
            },
            // Finally we have a collection of referenced documents
            {
              $replaceRoot: { newRoot: '$lookupOne' },
            },
          ]
        : []),
    ];

    // Find exactly one reference associated with this subPath's value
    rootRefModel.aggregate(aggregationOptions).exec(function (err, refSubDocuments) {
      if (error) return;

      resolvedCount++;

      if (err) {
        error = true;
        return cb(err);
      }

      // Associate every retrieved referenced subDocument to the corresponding doc
      for (let subDoc of refSubDocuments) {
        if (refIds[subDoc._id] && refIds[subDoc._id].docs) {
          for (let associatedDoc of refIds[subDoc._id].docs)
            associatedDoc.set(option.path, subDoc, mongoose.Schema.Types.Mixed);

          // Done with this ref
          delete refIds[subDoc._id];
        }
      }

      // The unresolved remaining refs must be set to null
      Object.keys(refIds).forEach((k) => {
        const associatedDocs = refIds[k].docs;
        for (let associatedDoc of associatedDocs)
          associatedDoc.set(option.path, null, mongoose.Schema.Types.Mixed);
      });

      if (resolvedCount === options.length) cb(null, docs);
    });
  }
}

/**
 * This plugin ensures that using subPopulate(options)
 * the resulting documents will have all sub document ref-fields populated,
 *
 * N.B.
 *  - Refs are specified using the property (subRef) on SchemaType's options
 *
 * @param {mongoose.Schema} schema the schema on which add the new function 'subPopulate'
 */
module.exports = function subDocumentReferences(schema) {
  const populableReferencesPaths = {};

  // Find all paths that contains a reference to sub documents
  eachPathRecursive(schema, (path, schemaType) => {
    if (schemaType.options.subRef) populableReferencesPaths[path] = schemaType;
  });

  /**
   * This will populate sub refs
   * @param {import('mongoose').ModelPopulateOptions[]|import('mongoose').ModelPopulateOptions|String[]|String} options
   * @returns {Promise}
   */
  schema.methods.subPopulate = function (options = null) {
    const model = this.constructor;

    if (options)
      return new Promise((resolve, reject) =>
        execute(model, [this], options, false, function (err, docs) {
          if (err) return reject(err);
          return resolve(docs[0]);
        })
      );
    else Promise.resolve();
  };
};
