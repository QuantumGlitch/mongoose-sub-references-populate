# Package: mongoose-sub-references-populate

Package useful for populating references to sub documents.
It will add a query builder helper and a model's method helper.

**N.B:**
**Using sub references is considered in most of the cases an anti-pattern that you should avoid (usually you can re-organize your data to avoid it).**

# Install

```shell
npm i mongoose-sub-references-populate
```

# Setup

```js
// Including the library will add 'subPopulate' helper for query
const subReferencesPopulate = require('mongoose-sub-references-populate');

const TestSchema = new mongoose.Schema({});

// Applying as plugin on the schema will provide 'subPopulate' method on the model
TestSchema.plugin(subReferencesPopulate);
const TestModel = mongoose.model('Test', TestSchema);
```

# Usage

## Defining a sub reference

## To an Array of SubDocuments

For example:

```js
const PersonSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  contacts: [
    {
      email: {
        type: String,
      },
    },
  ],
});
const PersonModel = mongoose.model('Person', PersonSchema);

const MessageSchema = new mongoose.Schema({
  contact: {
    type: mongoose.Schema.Types.ObjectId,
    subRef: 'Person.contacts',
  },
  content: {
    type: String,
  },
});
MessageSchema.plugin(subReferencesPopulate);
const MessageModel = mongoose.model('Message', MessageSchema);
```

The **subRef: 'Person.contacts'** will do the magic.
You can now call the following methods:

```js
    const message = await MessageModel.findById(...);
    message.subPopulate('contact');

    // or
    const subPopulatedResults = await MessageModel.find(..).subPopulate('contact');
```

The field 'contact' will be populated with the corresponding referenced sub document.

## To an Array of References

For example:

```js
const ContactSchema = new mongoose.Schema({
  email: {
    type: String,
  },
});
const ContactModel = mongoose.model('Contact', ContactSchema);

const PersonSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }],
});
const PersonModel = mongoose.model('Person', PersonSchema);

const MessageSchema = new mongoose.Schema({
  contact: {
    type: mongoose.Schema.Types.ObjectId,
    subRef: 'Person.contacts',
  },
  content: {
    type: String,
  },
});

MessageSchema.plugin(subReferencesPopulate);
const MessageModel = mongoose.model('Message', MessageSchema);
```

You might think it would be better to put a direct reference to the **ContactModel** instead of **Person.contacts**. The difference will be: if it doesn't exist a Person with the referenced sub document than contact will not be sub populated even if it has the right \_id to an existing Contact. If you sub populate this way, you're sure that a Person has that contact.

## Bound to fields

If you want to increase the performance of the queries, it is possibile to use the boundTo schemaType options:

```js
const PersonSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  contacts: [
    {
      email: {
        type: String,
      },
    },
  ],
});
const PersonModel = mongoose.model('Person', PersonSchema);

const MessageSchema = new mongoose.Schema({
  person: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person',
    required: true,
  },
  contact: {
    type: mongoose.Schema.Types.ObjectId,
    subRef: 'Person.contacts',
    boundTo: 'person',
  },
  content: {
    type: String,
  },
});
MessageSchema.plugin(subReferencesPopulate);
const MessageModel = mongoose.model('Message', MessageSchema);
```

Storing the root reference of where is the sub document we're interested in.

## Nesting paths

Both subRef and boundTo allow any path you want. The most important thing is to remember it must ends with a schema type Array of References or Array of Sub Documents and it must have not arrays in the between path.

Object --- > Object ---> .... any time you want ---> Array

# Test

You can try the tests using the following command ( before you need to change the connection to MongoDB ) :
```shell
npm install --test
npm run test
```

# See also

If you want to provide an integrity to your sub references, you could be interested in [sub-references-integrity](https://github.com/QuantumGlitch/mongoose-sub-references-integrity)

# Support

If you would like to support my work, [please buy me a coffe ☕](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=HRVBJMSU9CQXW).
Thanks in advice.
