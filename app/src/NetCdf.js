import Mapbox from 'mapbox-gl';
import { GeoPrint, numpyDataLoader } from './GeoPrint';

export default async function netCDF ({url, variable}) {
  let numpy = numpyDataLoader();
  let year = 2010;
  let day = 1; 
  let ncBound = await axios.get(
    `${url}/gridmet/${year}/${day}/${variable}/bound`
  );
  let nc = await numpy.get(
    `${url}/gridmet/${year}/${day}/${variable}/data`
  );
  let ncLat = await numpy.get(
    `${url}/gridmet/${year}/${day}/${variable}/lat`
  );
  let ncLng = await numpy.get(
    `${url}/gridmet/${year}/${day}/${variable}/lon`
  );

  let bound = ncBound.data;

  let data = {
    lat: ncLat.data,
    lng: ncLng.data,
    values: nc.data
  };

  let topLeft = this.map.project({ lng: bound.left, lat: bound.top });
  let bottomRight = this.map.project({
    lng: bound.right,
    lat: bound.bottom
  });
  let width = Math.ceil(bottomRight.x - topLeft.x);
  let height = Math.ceil(bottomRight.y - topLeft.y);
  let mapData = new Float32Array(width * height);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let coord = this.map.unproject({
        x: x + topLeft.x,
        y: y + topLeft.y
      });
      let lngIdx = data.lng.findIndex(d => d > coord.lng);
      let latIdx = data.lat.findIndex(d => d < coord.lat);
      let value = data.values[latIdx * nc.shape[1] + lngIdx];
      value +=
        lngIdx < data.lng.length
          ? data.values[latIdx * nc.shape[1] + lngIdx + 1]
          : value;
      value +=
        latIdx < data.lat.length
          ? data.values[(latIdx + 1) * nc.shape[1] + lngIdx]
          : value;
      if (lngIdx < data.lng.length && latIdx < data.lat.length) {
        value += data.values[(latIdx + 1) * nc.shape[1] + lngIdx + 1];
      }
      //TODO: use bilinear interpolation instead of averging the closest 4 locations
      value *= 0.25;

      if (Number.isNaN(value)) {
        value = -9999;
      }
      mapData[y * width + x] = value;
    }
  }

  let ncLayer = new GeoPrint({
    bound,
    width,
    height,
    data: mapData,
    dataDomain: [bound.min, bound.max],
    // colorMap: 'RdBu', //'RdBu',
    coordinateMap: Mapbox.MercatorCoordinate.fromLngLat
  });

  return {
    id: "NetCDF",
    type: "custom",
    onAdd(map, gl) {
      ncLayer.init(gl);
    },
    render(gl, matrix) {
      ncLayer.render(matrix);
    },
    bound
  };
}