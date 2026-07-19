const { getConfig } = require('./_lib/mongodb');

module.exports = async function handler(req, res) {
  const config = getConfig();

  return res.status(200).json({
    env: {
      hasMongoUri: Boolean(config.uri),
      databaseName: config.database || null,
      collectionName: config.collection || null,
    },
  });
};
