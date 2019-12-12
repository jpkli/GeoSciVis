import tornado.ioloop
import tornado.web
import rasterio as rio
import tornado.websocket
import io
import numpy as np
import xarray as xr
from pyproj import Transformer
from tornado.options import define, options

define("datafile", default='', help="load data from file", type=str)
define("port", default=8888, help="run on the given port", type=int)

class DataHandler(tornado.web.RequestHandler):
    def set_default_headers(self):
        self.set_header("Access-Control-Allow-Origin", "http://localhost:8080")
        self.set_header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
        self.set_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')

    def options(self):
        # no body
        self.set_status(204)
        self.finish()

class GeoTiffDataHandler(DataHandler):
    file = ''
    data = []
    bound = []

    def get(self, param):
      if param == 'bound':
        bound = GeoTiffDataHandler.bound
        transformer = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)
        leftTop = transformer.transform(bound.left, bound.top)
        rightBottom = transformer.transform(bound.right, bound.bottom)
        self.write({
          'left': leftTop[0],
          'top': leftTop[1],
          'right': rightBottom[0],
          'bottom': rightBottom[1]
        })
      else:
        print(GeoTiffDataHandler.file)
        with rio.open(GeoTiffDataHandler.file) as ff:
          band = ff.read(1, masked = True)
          GeoTiffDataHandler.bound = ff.bounds
          memfile = io.BytesIO()
          np.save(memfile, band)
          memfile.seek(0)
          self.write(memfile.read())

# class NcDataHandler(DataHandler):
#     data = []
#     bound = []
    
#     def get(self, param):
#       if param == 'bound':
#         self.write(NcDataHandler.bound)
#       else:
#         data = np.load(file)
#         memfile = io.BytesIO()
#         np.save(memfile, data)
#         memfile.seek(0)
#         self.write(memfile.read())      

def make_app():
    return tornado.web.Application([
      (r"/geotiff/([^/]+)", GeoTiffDataHandler)
    ])

if __name__ == "__main__":
    tornado.options.parse_command_line()
    app = make_app()
    app.listen(options.port)
    GeoTiffDataHandler.file = options.datafile
    print("HTTP and WebSocket listening on", 'localhost', options.port)
    tornado.ioloop.IOLoop.current().start()
