<template>
  <v-app>
    <v-app-bar
      app
      color="#666"
      clipped-left
      dark
    >
      <v-app-bar-nav-icon @click="drawer=!drawer"></v-app-bar-nav-icon>
      <v-toolbar-title >GeoVis</v-toolbar-title>
    </v-app-bar>

    <v-content>
      <v-container fluid class="fill-height">
        <v-row class="fill-height" id="mapbox-container">
        </v-row>
      </v-container>
    </v-content>
    <v-navigation-drawer
      v-model="drawer"
        app
        flat
        clipped
        width="20%"
        class="pa-5"
    >
    <v-col>
      <p>Select Map Layer: </p>
      <v-overflow-btn
        class="my-2"
        :items="layerNames"
        item-value="text"
        v-model="selectedLayer"
      ></v-overflow-btn>
    </v-col>
    </v-navigation-drawer>
    <v-dialog
      v-model="loadingData"
      hide-overlay
      persistent
      width="380"
      height="380"
    >
      <v-card
        dark
        class="text-center pa-3"
      >
        <h3 class="text-center ma-5">Please Wait</h3>
        <v-card-text>
          <v-progress-circular
          :size="60"
          :width="7"
          color="primary"
          indeterminate
        ></v-progress-circular>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-app>
  
</template>

<script>
import Mapbox from 'mapbox-gl';
import { GeoPrint, numpyDataLoader } from '../GeoSciVis';
import axios from 'axios';
import { config } from '../app.config';

export default {
  components: {
  },
  data() {
    return {
      dataServerUrl: config.dataServer.url,
      accessToken: config.mapbox.accessToken,
      map: null,
      numpy: null,
      isMapLayerReady: false,
      drawer: true,
      selectedLayer: 'All',
      mapLayers: {},
      layerNames: [
        'All',
        'Shapefile',
        'GeoTiff',
        'NetCDF'
      ],
      loadingData: true
    };
  },
  watch: {
    selectedLayer () {
      if (this.selectedLayer === 'All') {
        this.layerNames.slice(1)
        .forEach(layer => {
          this.map.setLayoutProperty(layer, 'visibility', 'visible');
        })
      } else {
        this.layerNames.slice(1).filter(layer => layer !== this.selectedLayer).forEach(layer => {
          this.map.setLayoutProperty(layer, 'visibility', 'none');
        })
        this.map.setLayoutProperty(this.selectedLayer, 'visibility', 'visible');
        let bound = this.mapLayers[this.selectedLayer].bound
        this.map.fitBounds([
          [bound.left, bound.top],
          [bound.right, bound.bottom]
        ]);
      }
    },
    async selectedNetCDFVar () {
      this.map.removeLayer('NetCDF');
      let netCDFLayer = await this.netCDF();
      this.map.addLayer(netCDFLayer, 'Shapefile');
    }
  },
  created() {
    this.numpy = numpyDataLoader();
  },
  mounted () {
    Mapbox.accessToken = this.accessToken;
    this.map = new Mapbox.Map({
      container: 'mapbox-container',
      style: "mapbox://styles/mapbox/light-v10",
      center: [-95.7129, 37.0902], //center in USA
      zoom: 3
    })

    this.map.on('load', evt => {
      this.visualizeMapLayers(evt);
    })
  },
  methods: {
    async visualizeMapLayers () {
      let geoTiff = await this.geoTiff();

      /* Initialize the bounding based on map layers */
      let bound = geoTiff.bound
      this.map.fitBounds([
        [bound.left, bound.top],
        [bound.right, bound.bottom]
      ]);
      this.loadingData = false

      /* if fitting bound, use the moveend callback */
      this.map.on("moveend", () => {
        if (!this.isMapLayerReady) {
          this.map.addLayer(geoTiff, 'building');
          this.isMapLayerReady = true;
        }
      });

      /* For Shapefile and NetCDF */
      // this.mapLayers.Shapefile = await this.shapefile();
      // this.mapLayers.NetCDF = await this.netCDF();
      // this.map.addLayer(this.mapLayers.Shapefile, 'building');
      // this.map.addLayer(this.mapLayers.NetCDF, this.mapLayers.Shapefile.id);
    },

    async geoTiff() {
      let url = this.dataServerUrl;
      let geotiff = await axios.get(`${url}/geotiff/data`);
      let specs = await axios.get(`${url}/geotiff/specs`);
      let spec = specs.data
      let geotiffLayer = new GeoPrint({
        bound: spec.bounds,
        width: spec.dimensions.x,
        height: spec.dimensions.y,
        dataspd: geotiff.data.speed,
        datavel: geotiff.data.velocity,
        dataDomain: [[spec.minmax_vectors.u[0], spec.minmax_vectors.u[1]], [spec.minmax_vectors.v[0], spec.minmax_vectors.v[1]]], 
        colorMap: 'BuRd', //'RdYlBu', //'RdBu',
        coordinateMap: Mapbox.MercatorCoordinate.fromLngLat
      });

      return {
        id: "GeoTiff",
        type: "custom",
        onAdd(map, gl) {
          geotiffLayer.init(gl);
        },
        render(gl, matrix) {
          var updater = function() {
            geotiffLayer.draw();
            requestAnimationFrame(updater);
          };
          geotiffLayer.setMatrix(matrix);
          updater();
        },
        bound: spec.bounds
      }
    }
  }
};
</script>
