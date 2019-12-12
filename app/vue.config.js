const path = require('path')
module.exports = {
  chainWebpack: config => {
    config.resolve.alias
      .set('@GeoSciVis', path.resolve(__dirname, '../src'));
  }
}
