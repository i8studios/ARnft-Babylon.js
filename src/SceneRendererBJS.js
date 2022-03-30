import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color3, Color4, Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { VideoTexture } from '@babylonjs/core/Materials/Textures/videoTexture';

if (process.env.NODE_ENV == 'development') {
    import('@babylonjs/core/Debug/debugLayer');
    import('@babylonjs/inspector');
}

import '@babylonjs/core/Meshes/instancedMesh';
import '@babylonjs/loaders/glTF';
import { Texture } from "@babylonjs/core";

export default class SceneRendererBJS {

    /**
     * Create a new BabylonJS renderer for ARnft.
     * 
     * @param {HTMLCanvasElement} canvas 
     * @param {string} uuid 
     */
    constructor (canvas, uuid) {
        this.uuid = uuid;
        this.target = window || global;

        this.engine = new Engine(canvas);
        this.scene = new Scene(this.engine);
        this.scene.clearColor = new Color4(0, 0, 0, 0);
        this.scene.useRightHandedSystem = true;

        this.camera = new Camera('camera', new Vector3(0, 0, 0), this.scene);
        this.camera.fovMode = Camera.FOVMODE_VERTICAL_FIXED;

        this.light = new HemisphericLight('light', new Vector3(0, 1, 0), this.scene);
    }

    /**
     * Start Babylon.js render loop.
     */
    start () {
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });
    }

    // Shared by all add* methods. Sets up the root mesh to listen to AR controller events with new matrix
    _addRoot (root, name, visibility) {
        this.target.addEventListener(`getMatrixGL_RH-${this.uuid}-${name}`, e => {
            root.setEnabled(true);
            
            const matrix = this._objectToMatrix(e.detail.matrixGL_RH);
            const rotationMatrix = matrix.getRotationMatrix();
            const rotation = new Quaternion().fromRotationMatrix(rotationMatrix);
            root.rotation = rotation.toEulerAngles();
            const position = Vector3.TransformCoordinates(Vector3.Zero(), matrix);
            root.setAbsolutePosition(position);
            // root.freezeWorldMatrix(matrix);
        });

        this.target.addEventListener(`nftTrackingLost-${this.uuid}-${name}`, e => {
            root.setEnabled(!!visibility);
        });
    }

    // Convert an object with numeric keys into an array, then a Matrix
    _objectToMatrix (obj) {
        const array = [];
        for (const key in obj) {
            array[key] = obj[key];
        }
        return Matrix.FromArray(array);
    }

    /**
     * 
     * The `process` parameter takes a function that is called with the imported scene data + marker name and returns an
     * object with `{ mesh, animation || animations }`. If you don't provide one, we will do the following things:
     * - sets `mesh` by finding mesh with id `__root__`
     * - disposes of the mesh with the name "Default Light" so we don't mess with scene lighting
     * - stops animations from automatically playing
     * - sets `animation` if the first animation is named "All Animations" or "Animation"
     * - or else sets `animations` to an array of all animatimons
     * - renames mesh and animation to name + ' Mesh' or name + ' Animation'
     * 
     * This is specifically designed to work well with GLB models exported from Blender.
     * 
     * @param {string} url url of glb file
     * @param {string} name name of AR marker to attach to
     * @param {number} scale scaling to apply to model (default: 15)
     * @param {boolean} visibility should model stay visible when tracking lost? (default: false)
     * @param {function} process run this funciton on imported glb data, see above (optional)
     */
    async addModel ({ url, name, scale = 15, visibility = false, process }) {
        const data = await SceneLoader.ImportMeshAsync('', url, '', this.scene);
        
        process = process || this._processModelData;

        const model = process(data);
        const root = new Mesh(name + ' Root', this.scene);

        for (const material of this.scene.materials) {
            material.useLogarithmicDepth = true;
        }

        model.mesh.parent = root;
        model.mesh.scaling.setAll(scale);

        this.target.addEventListener(`getNFTData-${this.uuid}-${name}`, e => {
            const msg = e.detail;
            model.mesh.position.y = ((msg.height / msg.dpi) * 2.54 * 10) / 2;
            model.mesh.position.x = ((msg.width / msg.dpi) * 2.54 * 10) / 2;
        });

        this._addRoot(root, name, visibility);

        return model;
    }

    _processModelData (data, name) {
        const model = {};

        // Find the mesh named __root__ and use it as our main mesh + rename it
        model.mesh = data.meshes.find(mesh => mesh.id == '__root__');
        model.mesh.name = name + ' Mesh';
        model.mesh.id = model.mesh.name;

        // Dispose of the default light
        const light = data.meshes.find(mesh => mesh.id == 'Default Light');
        light && light.dispose();

        // Stop all animations
        for (const animationGroup of data.animationGroups) {
            animationGroup.stop();
        }

        // Find the first animation or fall back to including the array of animations
        const firstAnim = data.animationGroups[0];
        if (firstAnim && (firstAnim.name == 'All Animations' || firstAnim.name == 'Animation')) {
            model.animation = firstAnim;
            model.animation.name = name + ' Animation';
        } else {
            model.animations = data.animationGroups;
        }

        return model;
    }

    /**
     * Add a video to an AR marker.
     * 
     * @param {string|HTMLVideoElement} src video url or video element
     * @param {string} name name of AR marker to attach to
     * @param {number} scale scaling to apply to model
     * @param {boolean} visibility should model stay visible when tracking lost? (default: false)
     * @returns {HTMLVideoElement} video element
     */
    async addVideo ({ src, name, scale = 1, visibility = false }) {
        const root = new Mesh(name + ' Root', this.scene);

        const plane = CreatePlane(name + ' Plane', { width: 16 * 60, height: 9 * 60 }, this.scene);
        const material = new StandardMaterial('Video Material - ' + name, this.scene);
        const texture = new VideoTexture('Video - ' + name, src, this.scene, false, true, null,
            { autoUpdateTexture: true });

        plane.material = material;

        material.diffuseColor = Color3.Black();
        material.emissiveTexture = texture;

        plane.parent = root;
        plane.scaling.setAll(scale);
        plane.rotation.x = Math.PI;

        this.target.addEventListener(`getNFTData-${this.uuid}-${name}`, e => {
            const msg = e.detail;
            plane.position.y = ((msg.height / msg.dpi) * 2.54 * 10) / 2;
            plane.position.x = ((msg.width / msg.dpi) * 2.54 * 10) / 2;
        });

        this._addRoot(root, name, visibility);

        return texture.video;
    }

    /**
     * Add an image to an AR marker.
     * 
     * @param {string|HTMLImageElement} src image url or image element
     * @param {string} name name of AR marker to attach to
     * @param {number} scale scaling to apply to image
     * @param {boolean} visibility should image stay visible when tracking lost? (default: false)
     * @returns {Plane} plane that image is applied to
     */
    async addImage ({ src, name, scale = 1, visibility = false }) {
        const root = new Mesh(name + ' Root', this.scene);

        const plane = CreatePlane(name + ' Plane', { width: 16 * 60, height: 9 * 60 }, this.scene);
        const material = new StandardMaterial(name + ' Image Material', this.scene);

        let texture;

        if (typeof texture == "string") {
            texture = new Texture(src, this.scene, false, true, null);
        } else {
            texture = new Texture(null, this.scene, false, true, null, null, null, src);
        }

        plane.material = texture;

        material.diffuseColor = Color3.Black();
        material.emissiveTexture = texture;

        plane.parent = root;
        plane.scaling.setAll(scale);
        plane.rotation.x = Math.PI;

        this.target.addEventListener(`getNFTData-${this.uuid}-${name}`, e => {
            const msg = e.detail;
            plane.position.y = ((msg.height / msg.dpi) * 2.54 * 10) / 2;
            plane.position.x = ((msg.height / msg.dpi) * 2.54 * 10) / 2;
        });

        this._addRoot(root, name, visibility);

        return plane;
    }

    inspect () {
        this.scene.debugLayer.show();
    }
}
