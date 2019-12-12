# GeoSciVis

## Setup

### Install and start server
Requires python version >= 3.5
```bash
cd server
pip install -r requirements.txt

# start server
python api.py --datafile='<path-to-data-file>'
```

### Install and run web app

First install [yarn](https://yarnpkg.com/lang/en/docs/cli/install/) and [vue-cli](https://cli.vuejs.org/guide/installation.html)

Place your MapBox access token in the 'app/app.config.js' file.

```bash
cd app
yarn install
yarn serve
```

After these commands, the web app should be hosted at http://localhost:8080
