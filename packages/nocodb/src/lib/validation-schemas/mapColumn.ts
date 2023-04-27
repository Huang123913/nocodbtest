// insert schema object
const insert = {
  type: 'object',
  required: ['id', 'fk_view_id', 'fk_column_id', 'label', 'show', 'order'],
  properties: {
    id: {
      type: 'string',
      maxLength: 20,
    },
    base_id: {
      type: 'string',
      maxLength: 20,
    },
    project_id: {
      type: 'string',
      maxLength: 128,
    },
    fk_view_id: {
      type: 'string',
      maxLength: 20,
    },
    fk_column_id: {
      type: 'string',
      maxLength: 20,
    },
    uuid: { type: ['string', 'null'], maxLength: 255 },
    label: {
      type: 'string',
      maxLength: 255,
    },
    help: {
      type: 'string',
      maxLength: 255,
    },
    show: {
      type: 'boolean',
    },
    order: {
      type: 'number',
    },
    created_at: {},
    updated_at: {},
  },
};

// update schema object
const update = {
  type: 'object',
  minProperties: 1,
  properties: {
    id: {
      type: 'string',
      maxLength: 20,
    },
    base_id: {
      type: 'string',
      maxLength: 20,
    },
    project_id: {
      type: 'string',
      maxLength: 128,
    },
    fk_view_id: {
      type: 'string',
      maxLength: 20,
    },
    fk_column_id: {
      type: 'string',
      maxLength: 20,
    },
    uuid: { type: ['string', 'null'], maxLength: 255 },
    label: {
      type: 'string',
      maxLength: 255,
    },
    help: {
      type: 'string',
      maxLength: 255,
    },
    show: {
      type: 'boolean',
    },
    order: {
      type: 'number',
    },
    created_at: {},
    updated_at: {},
  },
};

export default {
  insert,
  update,
};
