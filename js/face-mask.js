const webcamElement = document.getElementById('webcam');
const canvasElement = document.getElementById('canvas');
const imageElement = document.getElementById('faces');
const webcam = new Webcam(webcamElement, 'user');
let selectedMask = $(".selected-mask img");
let isVideo = false;
let model = null;
let cameraFrame = null;
let detectFace = false;
let clearMask = false;
let maskOnImage = false;
let masks = [];
let maskKeyPointIndexs = [10, 234, 152, 454]; //overhead, left Cheek, chin, right cheek


$("#webcam-switch").change(function () {
    if(this.checked){
        $('.md-modal').addClass('md-show');
        webcam.start()
            .then(result =>{
                isVideo = true;
                cameraStarted();
                switchSource();               
                console.log("webcam started");                
                maskOnImage = false;
                startFaceMask();
            })
            .catch(err => {
                displayError();
            });
    }
    else {      
        webcam.stop();
        if(cameraFrame!= null){
            clearMask = true;
            detectFace = false;
            cancelAnimationFrame(cameraFrame);
        }
        isVideo = false;
        switchSource();
        cameraStopped(true);
        console.log("webcam stopped");
    }        
});

$("#arrowLeft").click(function () {
    let itemWidth = parseInt($("#mask-list ul li").css("width")) 
                    + parseInt($("#mask-list ul li").css("margin-left")) 
                    + parseInt($("#mask-list ul li").css("margin-right"));
    let marginLeft = parseInt($("#mask-list ul").css("margin-left"));
    $("#mask-list ul").css({"margin-left": (marginLeft+itemWidth) +"px", "transition": "0.3s"});
});

$("#arrowRight").click(function () {
    let itemWidth = parseInt($("#mask-list ul li").css("width")) 
    + parseInt($("#mask-list ul li").css("margin-left")) 
    + parseInt($("#mask-list ul li").css("margin-right"));
    let marginLeft = parseInt($("#mask-list ul").css("margin-left"));
    $("#mask-list ul").css({"margin-left": (marginLeft-itemWidth) +"px", "transition": "0.3s"});
});

$("#mask-list ul li").click(function () {
    $(".selected-mask").removeClass("selected-mask");
    $(this).addClass("selected-mask");
    selectedMask = $(".selected-mask img");
    clearCanvas();
    if(model !=null && isVideo == false && maskOnImage){
        detectFaces();
    }
});

$("#mask-btn").click(function () {
    $("#canvas").css({width: imageElement.clientWidth, height: imageElement.clientHeight});
    startFaceMask()
        .then(res => {
            maskOnImage = true;
            detectFaces();
        });
});

$('#closeError').click(function() {
    $("#webcam-switch").prop('checked', false).change();
});

async function startFaceMask() {
    return new Promise((resolve, reject) => {
        $(".loading").removeClass('d-none');
        faceLandmarksDetection.load(faceLandmarksDetection.SupportedPackages.mediapipeFacemesh).then(mdl => { 
            model = mdl;
            $(".loading").addClass('d-none');
            console.log("model loaded");
            if(isVideo && webcam.facingMode == 'user'){
                detectFace = true;
            }
            
            cameraFrame =  detectFaces();
            resolve();
        })
        .catch(err => {
            displayError('Fail to load face mesh model<br/>Please refresh the page to try again');
            reject(error);
        });
    });
}

async function detectFaces() {
    let inputElement = isVideo? webcamElement : imageElement;
    let flipHorizontal = isVideo;
    await model.estimateFaces
        ({
            input: inputElement,
            returnTensors: false,
            flipHorizontal: flipHorizontal,
            predictIrises: false
        }).then(predictions => {
        //console.log(predictions);
        drawMask(predictions);
        if(clearMask){
            clearCanvas();
            clearMask = false;
        }
        if(detectFace){
            cameraFrame = requestAnimFrame(detectFaces);
        }
    });
}

function drawMask(predictions){
    if(masks.length != predictions.length){
        clearCanvas();
    }   
    overheadIndex = 0;
    chinIndex = 2;
    if(isVideo){
        leftCheekIndex = 3;
        rightCheekIndex = 1;
    }
    else{
        leftCheekIndex = 1;
        rightCheekIndex = 3;
    }
    if (predictions.length > 0) {
        for (let x = 0; x < predictions.length; x++) {
            const keypoints = predictions[x].scaledMesh;  //468 key points of face;
           
            if(masks.length > x){
                dots = masks[x].keypoints;
                maskElement = masks[x].maskElement;
            }
            else{
                dots = [];
                maskElement = $("<img src='"+selectedMask.attr('src')+"' id='mask_"+x+"' class='mask' />");
                masks.push({
                    keypoints: dots,
                    maskElement: maskElement
                });
                maskElement.appendTo($("#canvas"));
            }
            for (let i = 0; i < maskKeyPointIndexs.length; i++) {
                const coordinate = getCoordinate(keypoints[maskKeyPointIndexs[i]][0], keypoints[maskKeyPointIndexs[i]][1]);
                if(dots.length > i){
                    dot = dots[i];
                }
                else{
                    dotElement = $("<div class='dot'></div>");
                    //dotElement.appendTo($("#canvas"));
                    dot = {top:0, left:0, element: dotElement};
                    dots.push(dot);
                }
                dot.left = coordinate[0];
                dot.top = coordinate[1];
                dot.element.css({top:dot.top, left:dot.left, position:'absolute'});
            }
            maskType = selectedMask.attr("data-mask-type");
            switch(maskType) {
                case 'full':
                    maskCoordinate= {top: dots[overheadIndex].top, left: dots[leftCheekIndex].left};
                    maskHeight = (dots[chinIndex].top - dots[overheadIndex].top) ;
                    break;
                case 'half':
                default:
                    maskCoordinate = dots[leftCheekIndex];
                    maskHeight = (dots[chinIndex].top - dots[leftCheekIndex].top) ;
                    break;
            }
            maskWidth = (dots[rightCheekIndex].left - dots[leftCheekIndex].left) ;
            maskSizeAdjustmentWidth = parseFloat(selectedMask.attr("data-scale-width"));
            maskSizeAdjustmentHeight = parseFloat(selectedMask.attr("data-scale-height"));
            maskSizeAdjustmentTop = parseFloat(selectedMask.attr("data-top-adj"));
            maskSizeAdjustmentLeft = parseFloat(selectedMask.attr("data-left-adj"));
            
            maskTop = maskCoordinate.top - ((maskHeight * (maskSizeAdjustmentHeight-1))/2) - (maskHeight * maskSizeAdjustmentTop);
            maskLeft = maskCoordinate.left - ((maskWidth * (maskSizeAdjustmentWidth-1))/2) + (maskWidth * maskSizeAdjustmentLeft);
            
            maskElement.css({
                top: maskTop, 
                left: maskLeft, 
                width: maskWidth * maskSizeAdjustmentWidth,
                height: maskHeight * maskSizeAdjustmentHeight,
                position:'absolute'
            });    
        }
    }
}

function getCoordinate(x,y){
    if(isVideo){
        if(webcam.webcamList.length ==1 || window.innerWidth/window.innerHeight >= webcamElement.width/webcamElement.height){
            ratio = canvasElement.clientHeight/webcamElement.height;
            resizeX = x*ratio;
            resizeY = y*ratio;
        }
        else if(window.innerWidth>=1024){
            ratio = 2;
            leftAdjustment = ((webcamElement.width/webcamElement.height) * canvasElement.clientHeight - window.innerWidth) * 0.38
            resizeX = x*ratio - leftAdjustment;
            resizeY = y*ratio;
        }
        else{
            leftAdjustment = ((webcamElement.width/webcamElement.height) * canvasElement.clientHeight - window.innerWidth) * 0.35
            resizeX = x - leftAdjustment;
            resizeY = y;
        }

        return [resizeX, resizeY];
    }
    else{
        return [x, y];
    }
}

function clearCanvas(){
    $("#canvas").empty();
    masks = [];
}

function switchSource(){
    if(isVideo){
        containerElement = $("#webcam-container");
        $("#button-control").addClass("d-none");
        resizeCanvas();
    }else{
        canvasElement.style.transform ="";
        containerElement = $("#image-container");
        $("#button-control").removeClass("d-none");
        $("#canvas").css({width: imageElement.clientWidth, height: imageElement.clientHeight});
    }
    $("#canvas").appendTo(containerElement);
    $(".loading").appendTo(containerElement);
    $("#mask-slider").appendTo(containerElement);
    clearCanvas();
}

$(window).resize(function() {
    resizeCanvas();
});