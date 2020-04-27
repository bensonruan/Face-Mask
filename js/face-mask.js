const webcamElement = document.getElementById('webcam');
const canvasElement = document.getElementById('canvas');
const imageElement = document.getElementById('faces');
const webcam = new Webcam(webcamElement, 'user');
let selectedMask = $(".selected-mask img");
let isVideo = false;
let model = null;
let cameraFrame = null;
let detectFace = false;
let masks = [];
let maskKeyPointIndexs = [10, 234, 152, 454]; //overhead, left Cheek, chin, right cheek


$("#webcam-switch").change(function () {
    if(this.checked){
        $('.md-modal').addClass('md-show');
        webcam.start()
            .then(result =>{
                cameraStarted();
                resizeCanvas();
                console.log("webcam started");
                isVideo = true;
                startFaceMask();
            })
            .catch(err => {
                displayError();
            });
    }
    else {      
        clearCanvas();  
        canvasElement.style.transform ="";
        cameraStopped();
        webcam.stop();
        if(cameraFrame!= null){
            detectFace = false;
            cancelAnimationFrame(cameraFrame);
        }
        console.log("webcam stopped");
    }        
});

$("#arrowLeft").click(function () {
    let itemWidth = parseInt($(".mask-list ul li").css("width")) 
                    + parseInt($(".mask-list ul li").css("margin-left")) 
                    + parseInt($(".mask-list ul li").css("margin-right"));
    let marginLeft = parseInt($(".mask-list ul").css("margin-left"));
    $(".mask-list ul").css({"margin-left": (marginLeft+itemWidth) +"px", "transition": "0.3s"});
});

$("#arrowRight").click(function () {
    let itemWidth = parseInt($(".mask-list ul li").css("width")) 
    + parseInt($(".mask-list ul li").css("margin-left")) 
    + parseInt($(".mask-list ul li").css("margin-right"));
    let marginLeft = parseInt($(".mask-list ul").css("margin-left"));
    $(".mask-list ul").css({"margin-left": (marginLeft-itemWidth) +"px", "transition": "0.3s"});
});

$(".mask-list ul li").click(function () {
    $(".selected-mask").removeClass("selected-mask");
    $(this).addClass("selected-mask");
    selectedMask = $(".selected-mask img");
    clearCanvas();
    if(model !=null && isVideo == false){
        detectFaces();
    }
});

$("#mask-btn").click(function () {
    $("#canvas").css({width: imageElement.clientWidth, height: imageElement.clientHeight});
    startFaceMask();
});

function startFaceMask() {
    $(".loading").removeClass('d-none');
    facemesh.load().then(mdl => { 
        model = mdl;
        $(".loading").addClass('d-none');
        console.log("model loaded");
        if(isVideo && webcam.facingMode == 'user'){
            canvasElement.style.transform = "scale(-1,1)";
            detectFace = true;
        }
        
        cameraFrame = detectFaces();
    })
    .catch(err => {
        displayError('Fail to load face mesh model<br/>Please refresh the page to try again');
    });
}

function detectFaces() {
    model.estimateFaces(isVideo? webcamElement : imageElement).then(predictions => {
        console.log(predictions);
        drawMask(predictions);
        if(detectFace){
            cameraFrame = requestAnimFrame(detectFaces);
        }
    });
}

function drawMask(predictions){
    if(masks.length != predictions.length){
        clearCanvas();
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
                    dot = {top:0, left:0};
                    dots.push(dot);
                }
                dot.left = coordinate[0];
                dot.top = coordinate[1];
            }
            maskType = selectedMask.attr("data-mask-type");
            switch(maskType) {
                case 'full':
                    maskCoordinate= {top: dots[0].top, left: dots[1].left};
                    maskHeight = (dots[2].top - dots[0].top) ;
                    break;
                case 'half':
                default:
                    maskCoordinate = dots[1];
                    maskHeight = (dots[2].top - dots[1].top) ;
                    break;
            }
            maskWidth = (dots[3].left - dots[1].left) ;
            maskSizeAdjustmentWidth = parseFloat(selectedMask.attr("data-scale-width"));
            maskSizeAdjustmentHeight = parseFloat(selectedMask.attr("data-scale-height"));
            maskSizeAdjustmentTop = parseFloat(selectedMask.attr("data-top-adj"));
            maskSizeAdjustmentLeft = parseFloat(selectedMask.attr("data-left-adj"));
            maskElement.css({
                top: maskCoordinate.top - ((maskHeight * (maskSizeAdjustmentHeight-1))/2) - (maskHeight * maskSizeAdjustmentTop), 
                left: maskCoordinate.left - ((maskWidth * (maskSizeAdjustmentWidth-1))/2) + (maskWidth * maskSizeAdjustmentLeft), 
                width: maskWidth * maskSizeAdjustmentWidth,
                height: maskHeight * maskSizeAdjustmentHeight,
                position:'absolute'
            });    
        }
    }
}

function getCoordinate(x,y){
    if(isVideo){
        var ratio = canvasElement.clientHeight/webcamElement.height;
        if(webcam.webcamList.length ==1 || window.innerWidth/window.innerHeight >= webcamElement.width/webcamElement.height){
            var leftAdjustment = 0;
        }else{
            var leftAdjustment = ((webcamElement.width/webcamElement.height) * canvasElement.clientHeight - window.innerWidth)/2 
        }
        var resizeX = x*ratio  - leftAdjustment;
        var resizeY = y*ratio;
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

$(window).resize(function() {
    resizeCanvas();
    clearCanvas();
});