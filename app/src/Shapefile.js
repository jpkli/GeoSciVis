import axios from 'axios';

export default async function shapefile ({url, map}) {
  let geojs = await axios.get(`${url}/fire/shapefile`);
  let bound = {
    left: geojs.data.bbox[0],
    right: geojs.data.bbox[2],
    bottom: geojs.data.bbox[1],
    top: geojs.data.bbox[3]
  }

  map.addSource("Shapefile", {
    type: "geojson",
    data: geojs.data
  });

  return  {
    id: "Shapefile",
    type: "fill",
    source: "Shapefile",
    paint: {
      "fill-color": "rgba(200, 100, 240, 0.4)"
    },
    filter: ["==", "$type", "Polygon"],
    bound
  }

}