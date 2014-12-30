
"use strict";

function setLoading(isLoading) {
    document.getElementById("loading").style.display = isLoading ? 'block' : 'none';
}

function disableInput(scene) {
    var controller = scene.screenSpaceCameraController;
    controller.enableInputs = false;
}

function enableInput(scene) {
    var controller = scene.screenSpaceCameraController;
    controller.enableInputs = true;
}

function flyToObject(scene, entity) {
    disableInput(scene);

    var time = cesiumWidget.clock.currentTime;

    entityView = new Cesium.EntityView(entity, scene);
    entityView.update(time);

    var objectPosition = entity.position.getValue(time);
    var cameraOffset = new Cesium.Cartesian3(-1.0, 0, 0);
    var direction = new Cesium.Cartesian3();
    Cesium.Cartesian3.negate(Cesium.Cartesian3.normalize(cameraOffset, direction), direction);

    var up = new Cesium.Cartesian3();
    Cesium.Cartesian3.cross(direction, objectPosition, up);
    Cesium.Cartesian3.cross(up, direction, up);
    Cesium.Cartesian3.normalize(up, up);

    var destination = new Cesium.Cartesian3();
    Cesium.Cartesian3.add(objectPosition, cameraOffset, destination);

    scene.camera.flyTo({
        destination : destination,
        direction : direction,
        up : up,
        duration : 2.0,
        complete : function() {
            enableInput(scene);
        }
    });
}

function createQuaternion(direction, up) {
    var right = new Cesium.Cartesian3();
    Cesium.Cartesian3.cross(direction, up, right);

    Cesium.Cartesian3.cross(right, direction, up);
    var viewMat = new Cesium.Matrix3( 	right.x,      right.y,      right.z,
                               			up.x,         up.y,         up.z,
                           				-direction.x, -direction.y, -direction.z);
    return Cesium.Quaternion.fromRotationMatrix(viewMat);
}

var transitionInProgress = false;
function flyToTime(jdate) {
    if(transitionInProgress) {
        return;
    }

    transitionInProgress = true;
    disableInput(cesiumWidget.scene);
    cesiumWidget.clock.shouldAnimate = false;

    var camera = cesiumWidget.scene.camera;
    var initialCameraPositionENU = Cesium.Cartesian3.clone(camera.position);
    var initialCameraPositionWC = Cesium.Cartesian3.clone(camera.positionWC);
    var initialObjectPositionWC = pathObject.position.getValue(cesiumWidget.clock.currentTime);

    var cameraOffsetWC = new Cesium.Cartesian3();
    Cesium.Cartesian3.subtract(initialCameraPositionWC, initialObjectPositionWC, cameraOffsetWC);
    Cesium.Cartesian3.multiplyByScalar(Cesium.Cartesian3.normalize(cameraOffsetWC, cameraOffsetWC), 75, cameraOffsetWC);

    var finalCameraPositionENU = new Cesium.Cartesian3();
    Cesium.Cartesian3.multiplyByScalar(Cesium.Cartesian3.normalize(initialCameraPositionENU, finalCameraPositionENU), 75, finalCameraPositionENU);

    var finalObjectPositionWC = pathObject.position.getValue(jdate);

    var finalCameraPositionWC = new Cesium.Cartesian3();
    Cesium.Cartesian3.add(finalObjectPositionWC, cameraOffsetWC, finalCameraPositionWC);

    var finalDirection = new Cesium.Cartesian3();
    Cesium.Cartesian3.normalize(Cesium.Cartesian3.negate(cameraOffsetWC, finalDirection), finalDirection);

    var finalRight = new Cesium.Cartesian3();
    Cesium.Cartesian3.normalize(Cesium.Cartesian3.cross(finalDirection, finalObjectPositionWC, finalRight), finalRight);

    var finalUp = new Cesium.Cartesian3();
    Cesium.Cartesian3.normalize(Cesium.Cartesian3.cross(finalRight, finalDirection, finalUp), finalUp);

    var finalRefFrame = Cesium.Transforms.eastNorthUpToFixedFrame(finalObjectPositionWC);
    var finalOffsetENU = new Cesium.Matrix4();
    Cesium.Matrix4.multiplyByVector(Cesium.Matrix4.getRotation(finalRefFrame, finalOffsetENU), cameraOffsetWC, finalOffsetENU);

    var initialOrientation = createQuaternion(camera.directionWC, camera.upWC);
    var finalOrientation = createQuaternion(finalDirection, finalUp);


    camera.setTransform(Matrix4.IDENTITY);


    var updateCamera = function(value) {
        var time = value.time;
        var orientation = new Cesium.Quaternion();
        Cesium.Quaternion.slerp(initialOrientation, finalOrientation, time, orientation);
        var rotationMatrix = Cesium.Matrix3.fromQuaternion(orientation);

        Cesium.Cartesian3.lerp(initialCameraPositionWC, finalCameraPositionWC, time, camera.position);
        Cesium.Matrix3.getRow(rotationMatrix, 0, camera.right);
        Cesium.Matrix3.getRow(rotationMatrix, 1, camera.up);
        Cesium.Matrix3.getRow(rotationMatrix, 2, camera.direction);
        Cesium.Cartesian3.negate(camera.direction, camera.direction);
    };

    var duration = 3.0;
    var animation =
        {
            duration : duration,
            easingFunction : Tween.Easing.Sinusoidal.InOut,
            startObject : {
                time : 0.0
            },
            stopObject : {
                time : 1.0
            },
            update : updateCamera,
            complete : function() {
                camera.transform = finalRefFrame;
                camera.position = finalCameraPositionENU;
                Cesium.Cartesian3.normalize(Cesium.Cartesian3.negate(camera.position, camera.direction), camera.direction);
                Cesium.Cartesian3.normalize(Cesium.Cartesian3.cross(camera.direction, Cesium.Cartesian3.UNIT_Z, camera.right), camera.right);
                Cesium.Cartesian3.normalize(Cesium.Cartesian3.cross(camera.right, camera.direction, camera.up), camera.up);
                enableInput(cesiumWidget.scene);
                cesiumWidget.clock.shouldAnimate = true;
                cesiumWidget.clock.currentTime = jdate;
                transitionInProgress = false;
            }
        };

    cesiumWidget.scene.tweens.add(animation);

}

var pathObject = 'undefined';
var location;
var currentTrail = 'undefined';
var pathVisualizers = 'undefined';
var trailsVisualizers = 'undefined';
var entityView;

var scratchMatrix = new Cesium.Matrix3();
function updateData() {

    if(cesiumWidget.clock.shouldAnimate === false){
        return;
    }

    var clock = cesiumWidget.clock;

    // update czml visualizations
    if(!Cesium.defined(cameraOrientaionObject)) {
        return;
    }

    // update the camera position
    if (typeof entityView !== 'undefined') {
        entityView.update(clock.currentTime);
    }
    
    var orientation = cameraOrientaionObject.orientation.getValue(clock.currentTime);
    var rotation = Cesium.Matrix3.fromQuaternion(orientation, scratchMatrix);
    
    var toVector = new Cesium.Cartesian3(0, 0, 1);
    var upVector = new Cesium.Cartesian3(0, -1, 0);
    
    Cesium.Matrix3.multiplyByVector(rotation, toVector, toVector);
    Cesium.Matrix3.multiplyByVector(rotation, upVector, upVector);
    
    var lookToPosition = new Cesium.Cartesian3();
    Cesium.Cartesian3.add(cesiumWidget.scene.camera.position, toVector, lookToPosition);
    
    cesiumWidget.scene.camera.lookAt(cesiumWidget.scene.camera.position, lookToPosition, upVector);
}

function setTimeFromBuffer(entityCollection) {

    var clock = cesiumWidget.clock;

    var availability = entityCollection.computeAvailability();
    if (availability.start.equals(Cesium.Iso8601.MINIMUM_VALUE)) {
        clock.startTime = new Cesium.JulianDate();
        clock.stopTime = Cesium.JulianDate.addDays(clock.startTime, 1, clock.stopTime);
        clock.clockRange = Cesium.ClockRange.UNBOUNDED;
        clock.multiplier = 60.0;
    } else {
        clock.startTime = availability.start;
        clock.stopTime = availability.stop;
    }

    clock.currentTime = clock.startTime;
    clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK_MULTIPLIER;
    timelineWidget.zoomTo(clock.startTime, clock.stopTime);

    animationWidget.viewModel.startTime = clock.startTime;
    animationWidget.viewModel.stopTime = clock.stopTime;
    
    clock.tick();
}


var timelineWidget;
var animationWidget;
var cesiumWidget;
var cameraOrientaionObject;
var cameraPositionObject;
$( document ).ready(function() {
    setLoading(true);

    var isChrome = window.chrome;
    if(!isChrome) {
        $('#errorDialog').dialog("open");
        return;
    }

    // help dialog
    $('#helpDialog').dialog("open");

    document.addEventListener("videoLoading", function() {
        cesiumWidget.clock.shouldAnimate = false;
        setLoading(true);
    }, false);

    document.addEventListener("videoLoaded", function() {
        cesiumWidget.clock.shouldAnimate = true;
        setLoading(false);
    }, false);

    // set the Bing Maps key
    Cesium.BingMapsApi.defaultKey = 'AkxNIkcN3YZwLVYAJpF08XExSR3DDR5OsItxNZYdwvIq0-RJT_VbPG9CD4OMvNw2';

    // initialize the Cesium widget
    cesiumWidget = new Cesium.CesiumWidget('cesiumContainer', {
        terrainProvider : new Cesium.CesiumTerrainProvider({
            url : 'http://cesiumjs.org/stk-terrain/tilesets/world/tiles'
        })
    });
    cesiumWidget._globe.depthTestAgainstTerrain = true;
    cesiumWidget.clock.onTick.addEventListener(updateData);

    // disable tilting with the middle mouse button
    cesiumWidget.scene.screenSpaceCameraController.tiltEventTypes = undefined;

    // initialize the animation controller
    var clockViewModel = new Cesium.ClockViewModel(cesiumWidget.clock);
    clockViewModel.owner = this;
    clockViewModel.shouldAnimate = true;
    clockViewModel.clockRange = Cesium.ClockRange.LOOP_STOP;
    var animationViewModel = new Cesium.AnimationViewModel(clockViewModel);
    animationViewModel.snapToTicks = ko.observable(true);
    animationViewModel.setShuttleRingTicks([0.0, 0.5, 1, 2, 3, 5, 10, 20, 50, 100]);
    var animationContainer = document.getElementById("animationContainer");
    animationWidget = new Cesium.Animation(animationContainer, animationViewModel);

    // initialize the timeline
    var timelineContainer = document.getElementById("timelineContainer");
    timelineWidget = new Cesium.Timeline(timelineContainer, cesiumWidget.clock);
    timelineWidget.addEventListener('settime',
        function onTimelineScrub(e) {
            cesiumWidget.clock.currentTime = e.timeJulian;
            cesiumWidget.clock.shouldAnimate = true;
        }, false
    );

    // fullscreen button
    var fullscreenContainer = document.createElement('div');
    fullscreenContainer.className = 'fullscreenContainer';
    var cesiumContainer = document.getElementById('fullScreenContainer');
    cesiumContainer.appendChild(fullscreenContainer);
    var fullscreenButton = new Cesium.FullscreenButton(fullscreenContainer, cesiumContainer);



    var orientationCzml = "Gallery/TestOrientation.czml";

    // load orientation czml
    var orientationCzmlDataSource = new Cesium.CzmlDataSource();
    orientationCzmlDataSource.loadUrl(orientationCzml).then(function() {

        var entityCollection =  orientationCzmlDataSource.entities;
        
       
        setTimeFromBuffer(entityCollection);
        cesiumWidget.clock.shouldAnimate = false;
        
        cameraOrientaionObject = entityCollection.getById("CameraOrientation");
        cameraPositionObject = entityCollection.getById("CameraPosition");
        
        flyToObject(cesiumWidget.scene, cameraPositionObject);
        
        setLoading(false);

    });
});
