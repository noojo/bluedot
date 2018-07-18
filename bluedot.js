
// blue 327798
// yellow F08834

var SWIFT = SWIFT || {};
SWIFT.yellow = 0xF08834;
SWIFT.blue = 0x327798;

SWIFT.Bluedot = function(container, opts) {
  opts = opts || {};
  
  var colorFn = opts.colorFn || function(x) {
    var c = new THREE.Color();
    c.setHSL( ( 0.6 - ( x * 0.5 ) ), 1.0, 0.5 );
    return c;
  };
  var imgDir = opts.imgDir || '/img/';

  var Shaders = {
    'earth' : {
      uniforms: {
        'texture': { type: 't', value: null }
      },
      vertexShader: [
        'varying vec3 vNormal;',
        'varying vec2 vUv;',
        'void main() {',
          'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
          'vNormal = normalize( normalMatrix * normal );',
          'vUv = uv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D texture;',
        'varying vec3 vNormal;',
        'varying vec2 vUv;',
        'void main() {',
          'vec3 diffuse = texture2D( texture, vUv ).xyz;',
          'float intensity = 1.05 - dot( vNormal, vec3( 0.0, 0.0, 1.0 ) );',
          'vec3 atmosphere = vec3( 1.0, 1.0, 1.0 ) * pow( intensity, 3.0 );',
          'gl_FragColor = vec4( diffuse + atmosphere, 1.0 );',
        '}'
      ].join('\n')
    },
    'atmosphere' : {
      uniforms: {},
      vertexShader: [
        'varying vec3 vNormal;',
        'void main() {',
          'vNormal = normalize( normalMatrix * normal );',
          'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vNormal;',
        'void main() {',
          'float intensity = pow( 0.8 - dot( vNormal, vec3( 0, 0, 1.0 ) ), 4.0 );',
          'gl_FragColor = vec4( 0.196, 0.466, 0.596, 1.0 ) * intensity;',
        '}'
      ].join('\n')
    }
  };

  var camera, scene, renderer, w, h;
  var earth_mesh, atmosphere, point;

  var radius = 200;

  var distance = 500, distanceTarget = 500;
  var padding = 40;

  var PI_HALF = Math.PI / 2;

  var earth_textures = ['world.jpg', '2k_earth_nightmap.jpg', '2k_nasa_earth.jpg', '2k_mars.jpg'];
  var earth_tex_index = 0;
  var uniforms;

  var stations = [];
  var station_data = [];

  function init() {

    var shader, material;
    var geometry = new THREE.SphereGeometry(radius, 40, 30);

    w = container.offsetWidth || window.innerWidth;
    h = container.offsetHeight || window.innerHeight;

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(w, h);

    camera = new THREE.PerspectiveCamera(30, w / h, 1, 10000);
    camera.position.z = distance;

    scene = new THREE.Scene();

    shader = Shaders['earth'];
    uniforms = THREE.UniformsUtils.clone(shader.uniforms);
    //uniforms['texture'].value = new THREE.TextureLoader().load(imgDir+'2k_earth_nightmap.jpg');
    uniforms['texture'].value = new THREE.TextureLoader().load(imgDir+earth_textures[earth_tex_index]);

    material = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: shader.vertexShader,
            fragmentShader: shader.fragmentShader
    });

    earth_mesh = new THREE.Mesh(geometry, material);
    earth_mesh.rotation.y = Math.PI;
    scene.add(earth_mesh);
    
    camera.lookAt(earth_mesh);

    shader = Shaders['atmosphere'];
    uniforms = THREE.UniformsUtils.clone(shader.uniforms);

    material = new THREE.ShaderMaterial({
          uniforms: uniforms,
          vertexShader: shader.vertexShader,
          fragmentShader: shader.fragmentShader,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          transparent: true
    });


    var atmos_mesh = new THREE.Mesh(geometry, material);
    atmos_mesh.scale.set( 1.1, 1.1, 1.1 );
    scene.add(atmos_mesh);

    // TODO: TRY OTHER SHAPES
    // geometry = new THREE.BoxGeometry(0.75, 0.75, 1);
    // geometry = new THREE.CylinderGeometry( 5, 5, 1, 6 );
    // shape for displayed point
    geometry = new THREE.SphereGeometry( 1, 4, 3 );
 
    point = new THREE.Mesh(geometry, material);
 
    renderer.domElement.style.position = 'absolute';
    container.appendChild(renderer.domElement);

    // event handling
    document.addEventListener('keydown', onDocumentKeyDown, false);
    window.addEventListener('resize', onWindowResize, false);

  }



  var last_point = undefined;

  // data functions
  function addPoint(lat, lng, size, color, subgeo, height=0.0) {

    var phi = (90 - lat) * Math.PI / 180;
    var theta = (180 - lng) * Math.PI / 180;

    var geometry = new THREE.SphereGeometry( 1, 4, 3 );
    var material = new THREE.MeshBasicMaterial({
          // uniforms: uniforms,
          // vertexShader: shader.vertexShader,
          // fragmentShader: shader.fragmentShader,
          vertexColors: THREE.FaceColors,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          transparent: true
    });
    var point = new THREE.Mesh(geometry, material);

    point.position.x = (radius + height) * Math.sin(phi) * Math.cos(theta);
    point.position.y = (radius + height) * Math.cos(phi);
    point.position.z = (radius + height) * Math.sin(phi) * Math.sin(theta);

    point.lookAt(earth_mesh.position);

    //point.scale.z = Math.max( size, 0.1 ); // avoid non-invertible matrix

    point.updateMatrix();

    // for (var i = 0; i < point.geometry.faces.length; i++) {
    //   point.geometry.faces[i].color = color;
    // }
    point.material.color.setHex(SWIFT.yellow);


    if(point.matrixAutoUpdate){
      point.updateMatrix();
    }

    scene.add(point);
    //subgeo.merge(point.geometry, point.matrix);

    stations.push(point);

  }

  function createPoints() {
    console.log('createPoints');

    if (this._baseGeometry !== undefined) {
      if (this.is_animated === false) {
        this.points = new THREE.Mesh(this._baseGeometry, new THREE.MeshBasicMaterial({
              color: 0xffffff,
              vertexColors: THREE.FaceColors,
              morphTargets: false
            }));
      } else {
        if (this._baseGeometry.morphTargets.length < 8) {
          console.log('t l',this._baseGeometry.morphTargets.length);
          var padding = 8-this._baseGeometry.morphTargets.length;
          console.log('padding', padding);
          for(var i=0; i<=padding; i++) {
            console.log('padding',i);
            this._baseGeometry.morphTargets.push({'name': 'morphPadding'+i, vertices: this._baseGeometry.vertices});
          }
        }
        this.points = new THREE.Mesh(this._baseGeometry, new THREE.MeshBasicMaterial({
              color: 0xffffff,
              vertexColors: THREE.FaceColors,
              morphTargets: true
            }));
      }
      scene.add(this.points);
    }
  }

  function addData(data, opts) {
    var lat, lng, size, color, i, step, colorFnWrapper;
    station_data = data;
    //opts.animated = false;
    this.is_animated = false;
    
    var subgeo = new THREE.Geometry();
    
    color = new THREE.Color(SWIFT.yellow);

    for (i = 0; i < data.length; i++) {
      addPoint(data[i].lat, data[i].lng, data[i].size * radius, color, subgeo, 1.5);
    }

    this._baseGeometry = subgeo;
  };

  function onDocumentKeyDown(event) {
    switch (event.keyCode) {
      case 38:
        zoom(10);
        event.preventDefault();
        break;
      case 40:
        zoom(-10);
        event.preventDefault();
        break;
      case 84:
        earth_tex_index++;
        earth_tex_index = earth_tex_index % earth_textures.length;
        console.log('loading earth_textures ', earth_tex_index);
        earth_mesh.material.uniforms['texture'].value = new THREE.TextureLoader().load(imgDir + earth_textures[earth_tex_index])
        earth_mesh.material.uniforms['texture'].needsUpdate = true;
        break;
    }
  }

  function onWindowResize( event ) {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( container.clientWidth , container.clientHeight);
  }

  // animation functions
  function zoom(delta) {
    distanceTarget -= delta;
    distanceTarget = distanceTarget > 1000 ? 1000 : distanceTarget;
    distanceTarget = distanceTarget < 201 ? 201 : distanceTarget;
  }

  function animate() {
    requestAnimationFrame(animate);
    
    render();
  }

  function render() {
    //zoom(curZoomSpeed);

    // rotation.x += (target.x - rotation.x) * 0.1;
    // rotation.y += (target.y - rotation.y) * 0.1;
    distance += (distanceTarget - distance) * 0.3;

    // camera.position.x = distance * Math.sin(rotation.x) * Math.cos(rotation.y);
    // camera.position.y = distance * Math.sin(rotation.y);
    // camera.position.z = distance * Math.cos(rotation.x) * Math.cos(rotation.y);
    
    TWEEN.update();
    camera.lookAt(earth_mesh.position);

    renderer.render(scene, camera);
  }

  var green_material = new THREE.MeshBasicMaterial({
      vertexColors: THREE.FaceColors,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true
  });

  var last_station_index = -1;

  function camera_move(latitude,longitude, station_index=0 ) {
    if ( ! latitude ) { return; }
    var phi = ( 90 - latitude ) * Math.PI / 180.0;
    var theta = (180  - longitude ) * Math.PI / 180.0;

    //console.log(camera.position);
    var dst_cam = new THREE.Vector3();

    dst_cam.x = distance * Math.sin(phi) * Math.cos(theta);
    dst_cam.y = distance * Math.cos(phi);
    dst_cam.z = distance * Math.sin(phi) * Math.sin(theta);

    if ( last_point ) {
      last_point.material.color.setHex(SWIFT.yellow);
      last_point.geometry.scale(.5,.5,.5);      
    }

    // for ( x in station_data) {
    //   stations[x].material.color.setHex(SWIFT.yellow);
    //   //stations[x].geometry.scale(.5,.5,.5);
    // }

    stations[station_index].material.color.setHex(0x00ff00);
    stations[station_index].geometry.scale(2,2,2);
    last_point = stations[station_index];
   // stations[station_index].geometry.scale(2,2,2);
    var tween = new TWEEN.Tween(camera.position).to(dst_cam, 2000);
    tween.start();



  }



  init();

  this.animate = animate;




  this.addData = addData;
  this.createPoints = createPoints;
  this.renderer = renderer;
  this.scene = scene;
  //this.camera_callback = camera_callback;
  this.camera_move = camera_move;
  this.stations = stations;

  return this;
}