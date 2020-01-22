import tornado.ioloop
import tornado.web
import rasterio as rio
import tornado.websocket
import io
import numpy as np
import xarray as xr
from pyproj import Transformer
from tornado.options import define, options
import os.path
import sys
import math

define("datafilelng", default='', help="load longitude data from file", type=str)
define("datafilelat", default='', help="load latitude data from file", type=str)
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
    files = ['','']
    data = {"velocity": [], "speed": []}
    bounds = []
    dimensions = {"x":0, "y":0}
    minmax_speeds = {"min" : float("inf"), "max" : -1 * float("inf")}
    minmax_vectors = {"u":[float("inf"), -1*float("inf")], "v":[float("inf"), -1*float("inf")]}

    def processDataFiles(self):
      fflng = rio.open(GeoTiffDataHandler.files[0])
      fflat = rio.open(GeoTiffDataHandler.files[1])
      bandlng = fflng.read(1, masked = True)
      bandlng_mask = fflng.read_masks(1)
      bandlat = fflat.read(1, masked = True)
      bandlat_mask = fflat.read_masks(1)
      if (fflng.bounds != fflat.bounds):
        print("Datafiles have invalid bounds")
        return False
      GeoTiffDataHandler.bounds = fflng.bounds
      # check height/width
      GeoTiffDataHandler.dimensions["x"] = fflng.width
      GeoTiffDataHandler.dimensions["y"] = fflng.height
      for j in range(fflng.height):
        for i in range(fflng.width):
          resxy = [0.0, 0.0]
          if (bandlng_mask[j, i]):
            resxy[0] = bandlng[j, i]
            if (resxy[0] < GeoTiffDataHandler.minmax_vectors["u"][0]):
              GeoTiffDataHandler.minmax_vectors["u"][0] = resxy[0]
            if (resxy[0] > GeoTiffDataHandler.minmax_vectors["u"][1]):
              GeoTiffDataHandler.minmax_vectors["u"][1] = resxy[0]
          if (bandlat_mask[j, i]):
            resxy[1] = bandlat[j, i]
            if (resxy[1] < GeoTiffDataHandler.minmax_vectors["v"][0]):
              GeoTiffDataHandler.minmax_vectors["v"][0] = resxy[1]
            if (resxy[1] > GeoTiffDataHandler.minmax_vectors["v"][1]):
              GeoTiffDataHandler.minmax_vectors["v"][1] = resxy[1]
          if (bandlng_mask[j, i] and bandlat_mask[j, i]):
            if (math.sqrt(pow(resxy[0], 2.0) + pow(resxy[1], 2)) > GeoTiffDataHandler.minmax_speeds["max"]):
              GeoTiffDataHandler.minmax_speeds["max"] = math.sqrt(pow(resxy[0], 2.0) + pow(resxy[1], 2))
            if (math.sqrt(pow(resxy[0], 2.0) + pow(resxy[1], 2)) < GeoTiffDataHandler.minmax_speeds["min"]):
              GeoTiffDataHandler.minmax_speeds["min"] = math.sqrt(pow(resxy[0], 2.0) + pow(resxy[1], 2))
            GeoTiffDataHandler.data["speed"] += [math.sqrt(pow(resxy[0], 2.0) + pow(resxy[1], 2))]
          else:
            GeoTiffDataHandler.data["speed"] += [-1]
          GeoTiffDataHandler.data["velocity"] += resxy

    def get(self, param):
      if param == 'specs':
        bound = GeoTiffDataHandler.bounds
        transformer = Transformer.from_crs("EPSG:3857", "EPSG:3857", always_xy=True)
        leftTop = transformer.transform(bound.left, bound.top)
        rightBottom = transformer.transform(bound.right, bound.bottom)
        self.write({"dimensions": GeoTiffDataHandler.dimensions, 
          "minmax_speeds": GeoTiffDataHandler.minmax_speeds, 
          "minmax_vectors" : GeoTiffDataHandler.minmax_vectors, 
          "bounds": {
          'left': leftTop[0],
          'top': leftTop[1],
          'right': rightBottom[0],
          'bottom': rightBottom[1]
        }})
      else:
        self.processDataFiles()
        print(GeoTiffDataHandler.files[0], GeoTiffDataHandler.files[1])
        self.write(GeoTiffDataHandler.data)

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
    if (os.path.splitext(options.datafilelng)[1] == ".tif" and os.path.splitext(options.datafilelat)[1] == ".tif"):
      GeoTiffDataHandler.files = [options.datafilelng, options.datafilelat]
    else:
      print("Data files given are unsupported")
      sys.exit()
    print("HTTP and WebSocket listening on", 'localhost', options.port)
    tornado.ioloop.IOLoop.current().start()
