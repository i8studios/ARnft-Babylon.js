# ARnft-Babylon.js

Rendering engine for [ARnft](https://github.com/webarkit/ARnft) based on Babylon.js.

## Usage
This is not a full, tested example, but should help you know how everything connects and compares to ARnft:

```html
<html>
<body>
    <div id="app">
        <video id="video" muted playsinline autoplay></video>
        <canvas id="canvas"></canvas>
        <video id="arvideo" src="url/to/video" playsinline crossorigin="anonymous"></video>
    </div>
</body>
</html>
```

```js
import { ARnft } from '@webarkit/ar-nft';
import SceneRendererBJS from 'arnft-babylonjs';

const nft = await ARnft.init(640, 480, [ 'url/to/marker' ], [ 'marker-name' ], 'url/to/config.json', false);

const scene = new SceneRendererBJS(document.getElementById('canvas'), nft.uuid);
scene.start();

// Add a video (can also use url as src)
scene.addVideo({ src: document.getElementById('arvideo'), name: 'marker-name' });

// Add a glb
scene.addModel({ url: 'url/to/model.glb', name: 'marker-name' });
```

config.json:
```json
{
  "addPath": "",
  "cameraPara": "camera_para.dat",
  "container": {
    "create": false,
    "containerName": "app",
    "canvasName": "canvas"
  },
  "videoSettings": {
    "width": {
      "min": 640,
      "max": 800
    },
    "height": {
      "min": 480,
      "max": 600
    },
    "facingMode": "environment"
  },
  "loading": {
    "create": false
  },
  "stats": {
    "createHtml": false
  }
}
```

## Babylon.js ES6 packages
Make sure you are using the [Babylon.js ES6 packages](https://doc.babylonjs.com/divingDeeper/developWithBjs/treeShaking) like we are. This is so that we are not importing the entire library, but only the parts we need, with support for tree shaking. And you will import only the parts you need. This does mean that you cannot mix this with the non-ES6 version of the library.
