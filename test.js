const assert = require('assert');
const mongoose = require('mongoose');
const subReferencesPopulate = require('./index');

mongoose.connect('mongodb://root@localhost:27017/admin', {
  dbName: 'mongoose-sub-references-populate',
  useUnifiedTopology: true,
});

mongoose.connection.on('error', console.error.bind(console, "Con't connect to MongoDB."));

describe('Array of sub documents', async function () {
  const PersonSchema = new mongoose.Schema({
    name: {
      type: String,
    },
    contacts: [
      {
        email: {
          type: String,
          required: true,
        },
        telephone: {
          type: String,
          required: false,
        },
      },
    ],
  });
  const PersonModel = mongoose.model('Person', PersonSchema);

  const MessageSchema = new mongoose.Schema({
    contact: {
      type: mongoose.Schema.Types.ObjectId,
      subRef: 'Person.contacts',
      required: true,
    },
    content: {
      type: String,
    },
  });
  MessageSchema.plugin(subReferencesPopulate);
  const MessageModel = mongoose.model('Message', MessageSchema);

  let parent, child;

  before(async function () {
    await PersonModel.deleteMany({});
    await MessageModel.deleteMany({});

    parent = await new PersonModel({
      contacts: [
        {
          email: 'test@test.com',
        },
        {
          email: 'test2@test.com',
        },
      ],
    }).save();

    child = await new MessageModel({
      contact: parent.contacts[0]._id,
    }).save();
  });

  it('Try populate document', async () => {
    await child.subPopulate('contact');
    assert.strictEqual(
      JSON.stringify(child.contact),
      JSON.stringify(parent.contacts[0]),
      'Child sub ref must be equal to parent sub document'
    );
  });

  it('Try populate by query', async () => {
    const res = await MessageModel.find().subPopulate('contact').exec();
    child = res[0];
    assert.strictEqual(
      JSON.stringify(child.contact),
      JSON.stringify(parent.contacts[0]),
      'Child sub ref must be equal to parent sub document'
    );
  });
});

describe('Array of refs', async function () {
  const ContactSchema = new mongoose.Schema({
    email: {
      type: String,
      required: true,
    },
  });
  const ContactModel = mongoose.model('Contact_2', ContactSchema);

  const PersonSchema = new mongoose.Schema({
    name: {
      type: String,
    },
    contacts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contact_2',
      },
    ],
  });
  const PersonModel = mongoose.model('Person_2', PersonSchema);

  const MessageSchema = new mongoose.Schema({
    contact: {
      type: mongoose.Schema.Types.ObjectId,
      subRef: 'Person_2.contacts',
      required: true,
    },
    content: {
      type: String,
    },
  });
  MessageSchema.plugin(subReferencesPopulate);
  const MessageModel = mongoose.model('Message_2', MessageSchema);

  let ref, parent, child;

  before(async function () {
    await ContactModel.deleteMany({});
    await PersonModel.deleteMany({});
    await MessageModel.deleteMany({});

    ref = await new ContactModel({ email: 'test@test.com' }).save();

    parent = await new PersonModel({
      contacts: [ref],
    }).save();

    child = await new MessageModel({
      contact: parent.contacts[0]._id,
    }).save();
  });

  it('Try populate document', async () => {
    await child.subPopulate('contact');
    assert.strictEqual(
      JSON.stringify(child.contact),
      JSON.stringify(parent.contacts[0]),
      'Child sub ref must be equal to parent sub document'
    );
  });

  it('Try populate by query', async () => {
    const res = await MessageModel.find().subPopulate('contact').exec();
    child = res[0];
    assert.strictEqual(
      JSON.stringify(child.contact),
      JSON.stringify(parent.contacts[0]),
      'Child sub ref must be equal to parent sub document'
    );
  });
});

describe('Nested array of sub documents', async function () {
  const PersonSchema = new mongoose.Schema({
    name: {
      type: String,
    },
    info: {
      contacts: [
        {
          email: {
            type: String,
            required: true,
          },
          telephone: {
            type: String,
            required: false,
          },
        },
      ],
    },
  });
  const PersonModel = mongoose.model('Person_3', PersonSchema);

  const MessageSchema = new mongoose.Schema({
    contact: {
      type: mongoose.Schema.Types.ObjectId,
      subRef: 'Person_3.info.contacts',
      required: true,
    },
    content: {
      type: String,
    },
  });
  MessageSchema.plugin(subReferencesPopulate);
  const MessageModel = mongoose.model('Message_3', MessageSchema);

  let parent, child;

  before(async function () {
    await PersonModel.deleteMany({});
    await MessageModel.deleteMany({});

    parent = await new PersonModel({
      info: {
        contacts: [
          {
            email: 'test@test.com',
          },
          {
            email: 'test2@test.com',
          },
        ],
      },
    }).save();

    child = await new MessageModel({
      contact: parent.info.contacts[0]._id,
    }).save();
  });

  it('Try populate document', async () => {
    await child.subPopulate('contact');
    assert.strictEqual(
      JSON.stringify(child.contact),
      JSON.stringify(parent.info.contacts[0]),
      'Child sub ref must be equal to parent sub document'
    );
  });

  it('Try populate by query', async () => {
    const res = await MessageModel.find().subPopulate('contact').exec();
    child = res[0];
    assert.strictEqual(
      JSON.stringify(child.contact),
      JSON.stringify(parent.info.contacts[0]),
      'Child sub ref must be equal to parent sub document'
    );
  });
});

describe('Bound to - Array of sub documents', async function () {
  const PersonSchema = new mongoose.Schema({
    name: {
      type: String,
    },
    contacts: [
      {
        email: {
          type: String,
          required: true,
        },
        telephone: {
          type: String,
          required: false,
        },
      },
    ],
  });
  const PersonModel = mongoose.model('Person_4', PersonSchema);

  const MessageSchema = new mongoose.Schema({
    person: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person_4',
      required: true,
    },
    contact: {
      type: mongoose.Schema.Types.ObjectId,
      subRef: 'Person_4.contacts',
      boundTo: 'person',
      required: true,
    },
    content: {
      type: String,
    },
  });
  MessageSchema.plugin(subReferencesPopulate);
  const MessageModel = mongoose.model('Message_4', MessageSchema);

  let parent, child;

  before(async function () {
    await PersonModel.deleteMany({});
    await MessageModel.deleteMany({});

    parent = await new PersonModel({
      contacts: [
        {
          email: 'test@test.com',
        },
      ],
    }).save();

    child = await new MessageModel({
      person: parent,
      contact: parent.contacts[0]._id,
    }).save();
  });

  it('Try populate document', async () => {
    await child.subPopulate('contact');
    assert.strictEqual(
      JSON.stringify(child.contact),
      JSON.stringify(parent.contacts[0]),
      'Child sub ref must be equal to parent sub document'
    );
  });

  it('Try populate by query', async () => {
    const res = await MessageModel.find().subPopulate('contact').exec();
    child = res[0];
    assert.strictEqual(
      JSON.stringify(child.contact),
      JSON.stringify(parent.contacts[0]),
      'Child sub ref must be equal to parent sub document'
    );
  });
});
