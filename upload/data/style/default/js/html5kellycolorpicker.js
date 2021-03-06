/**
 * @category  html5 widgets
 * @package   Kelly
 * @author    Rubchuk Vladimir <torrenttvi@gmail.com>
 * @copyright 2015-2016 Rubchuk Vladimir
 * @license   GPLv3
 * @version   1.03
 *
 * Usage example :
 *
 *   new KellyColorPicker({place : 'color-picker'});
 *
 **/

/**
 * Create color picker
 * @param {Array} cfg
 * @returns {KellyColorPicker}
 */

function KellyColorPicker(cfg) {
    var PI = Math.PI;

    var svFig;

    var svCursor = new Object;
    svCursor.radius = 4;

    var canvas = false;
    var ctx = false;

    var method = 'quad';
    var alpha = false;          // is alpha slider enabled
    var drag = false;
    var cursorAnimReady = true; // sets by requestAnimationFrame to limit FPS on events like mousemove etc. when draging 

    var events = new Array();
    var userEvents = new Array();

    var canvasHelper = document.createElement("canvas");
    var canvasHelperCtx = false; // used if needed to copy image data throw ctx.drawImage for save alpha channel
    var rendered = false;        // is colorpicecker rendered (without side alpha bar and cursors, rendered image stores in canvasHelperData
    var canvasHelperData = null; // rendered interface without cursors and without alpha slider [wheelBlockSize x wheelBlockSize]

    var input = false;

    // used by updateInput() function if not overloaded by user event
    var inputColor = true;     // update input color according to picker
    var inputFormat = 'mixed'; // mixed | hex | rgba

    var popup = new Object;    // popup block for input
    popup.tag = false;         // Dom element if popup is enabled
    popup.margin = 6;          // margin from input in pixels

    // container, or canvas element
    var place = false;
    var handler = this;

    var basePadding = 2;

    var padding;
    var wheelBlockSize = 200;
    var center;

    // current color
    var hsv;
    var rgb;
    var hex = '#000000';
    var a = 1;

    var wheel = new Object;
    wheel.width = 18;
    wheel.imageData = null; // rendered wheel image data
    wheel.innerRadius;
    wheel.startAngle = 0; // 150
    wheel.outerRadius;
    wheel.outerStrokeStyle = 'rgba(0,0,0,0.2)';
    wheel.innerStrokeStyle = 'rgba(0,0,0,0.2)';
    wheel.pos; // center point; wheel cursor \ hsv quad \ hsv triangle positioned relative that point
    wheel.draw = function () {

        if (this.imageData) {
            ctx.putImageData(this.imageData, 0, 0);
        } else {
            var hAngle = this.startAngle;
            for (var angle = 0; angle <= 360; angle++) {

                var startAngle = toRadians(angle - 2);
                var endAngle = toRadians(angle);

                ctx.beginPath();
                ctx.moveTo(center, center);
                ctx.arc(center, center, this.outerRadius, startAngle, endAngle, false);
                ctx.closePath();

                var targetRgb = hsvToRgb(hAngle / 360, 1, 1);
                ctx.fillStyle = 'rgb(' + targetRgb.r + ', ' + targetRgb.g + ', ' + targetRgb.b + ')';
                //ctx.fillStyle = 'hsl('+hAngle+', 100%, 50%)';
                ctx.fill();

                hAngle++;
                if (hAngle >= 360)
                    hAngle = 0;
            }

            ctx.globalCompositeOperation = "destination-out";
            ctx.beginPath();
            ctx.arc(center, center, this.innerRadius, 0, PI * 2);

            ctx.fill();

            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = this.innerStrokeStyle; // 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.closePath();

            // wheel border
            ctx.beginPath();
            ctx.arc(center, center, this.outerRadius, 0, PI * 2);
            ctx.strokeStyle = this.outerStrokeStyle;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.closePath();

            this.imageData = ctx.getImageData(0, 0, wheelBlockSize, wheelBlockSize);
        }

    };

    wheel.isDotIn = function (dot) {
        if (Math.pow(wheel.pos.x - dot.x, 2) + Math.pow(wheel.pos.y - dot.y, 2) < Math.pow(wheel.outerRadius, 2)) {
            if (Math.pow(wheel.pos.x - dot.x, 2) + Math.pow(wheel.pos.y - dot.y, 2) > Math.pow(wheel.innerRadius, 2)) {
                return true;
            }
        }
        return false;
    };

    var wheelCursor = new Object;
    wheelCursor.lineWeight = 2;
    wheelCursor.height = 4;
    wheelCursor.paddingX = 2; // padding from sides of wheel
    wheelCursor.path; // rotatePath2 --- поворот по старой функции, в фигуре не приплюсован центр

    var alphaSlider = new Object;
    alphaSlider.width = 18;
    alphaSlider.padding = 4;
    alphaSlider.outerStrokeStyle = 'rgba(0,0,0,0.2)';
    alphaSlider.innerStrokeStyle = 'rgba(0,0,0,0.2)';
    alphaSlider.height;
    alphaSlider.pos; // left top corner position
    alphaSlider.updateSize = function () {
        this.pos = {x: wheelBlockSize + alphaSlider.padding, y: alphaSlider.padding};
        this.height = wheelBlockSize - alphaSlider.padding * 2;
    };

    alphaSlider.draw = function () {
        var alphaGrd = ctx.createLinearGradient(0, 0, 0, this.height);
        alphaGrd.addColorStop(0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',1)');
        alphaGrd.addColorStop(1, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0)');

        ctx.beginPath();
        ctx.rect(this.pos.x, this.pos.y, this.width, this.height);
        ctx.fillStyle = "white";
        ctx.fill();
        ctx.fillStyle = alphaGrd;
        ctx.fill();

        ctx.strokeStyle = 'rgba(0,0,0, 0.2)';
        ctx.lineWidth = 2;

        ctx.stroke();
        ctx.closePath();
    };

    alphaSlider.dotToAlpha = function (dot) {
        return 1 - Math.abs(this.pos.y - dot.y) / this.height;
    };

    alphaSlider.alphaToDot = function (alpha) {
        return {
            x: 0,
            y: this.height - (this.height * alpha)
        };
    };

    alphaSlider.limitDotPosition = function (dot) {
        var y = dot.y;

        if (y < this.pos.y) {
            y = this.pos.y;
        }

        if (y > this.pos.y + this.height) {
            y = this.pos.y + this.height;
        }

        return {x: this.pos.x, y: y};
    };

    alphaSlider.isDotIn = function (dot) {
        if (dot.x < this.pos.x ||
                dot.x > this.pos.x + alphaSlider.width ||
                dot.y < this.pos.y ||
                dot.y > this.pos.y + this.height) {
            return false;
        }
        return true;
    };

    // svCursorMouse - для устройств с мышкой, генератор указателя в зависимости от активной области
    // todo on very very small sv when set by hex, cursor may be go out of bonds
    var svCursorMouse = new Object;

    svCursorMouse.svCursorData = null;
    svCursorMouse.stCursor = null; // cursor before replace
    svCursorMouse.curType = 0; // if > 0 cursor switched by KellyColorPicker to custom
    svCursorMouse.size = 16;

    svCursorMouse.initSvCursor = function () {
        if (!canvas)
            return false;
        var el = document.body;

        this.curType = 1;

        if (!this.stCursor)
            this.stCursor = el.style.cursor;
        if (!this.stCursor)
            this.stCursor = 'auto';

        if (this.svCursorData) {
            el.style.cursor = this.svCursorData;
            return true;
        }

        if (!canvasHelper)
            return false;

        // create canvas on 2 pixels bigger for Opera that cut image 
        var canvasSize = this.size + 2;

        canvasHelper.width = canvasSize;
        canvasHelper.height = canvasSize;

        canvasHelperCtx.clearRect(0, 0, this.size, this.size);
        canvasHelperCtx.strokeStyle = 'rgba(255, 255, 255, 1)';

        canvasHelperCtx.beginPath();
        canvasHelperCtx.lineWidth = 2;
        canvasHelperCtx.arc(canvasSize / 2, canvasSize / 2, this.size / 2, 0, PI * 2);

        canvasHelperCtx.stroke();
        canvasHelperCtx.closePath();

        var offset = canvasSize; //if (input.value.indexOf(curImageData) !== -1)
        var curImageData = canvasHelper.toDataURL();

        this.svCursorData = 'url(' + curImageData + ') ' + offset / 2 + ' ' + offset / 2 + ', auto';

        if (!this.svCursorData)
            return false;

        el.style.cursor = this.svCursorData;
        if (el.style.cursor.indexOf(curImageData) === -1) { // for autist IE (Edge also), that not support data-uri for cursor -_-
            this.svCursorData = 'crosshair';
            el.style.cursor = 'crosshair';
        }
        return true;
    };

    svCursorMouse.initStandartCursor = function () {
        if (!this.stCursor)
            return;
        svCursorMouse.curType = 0;
        document.body.style.cursor = this.stCursor;
    };

    svCursorMouse.updateCursor = function (newDot) {
        if (KellyColorPicker.cursorLock)
            return;

        if (svFig.isDotIn(newDot)) {
            svCursorMouse.initSvCursor();
        } else {
            svCursorMouse.initStandartCursor();
        }
    };

    // updateinput

    function constructor(cfg) {
        var criticalError = '', placeName = '';

        if (cfg.input && typeof cfg.input !== 'object') {
            cfg.input = document.getElementById(cfg.input);
            input = cfg.input;
            // if (!cfg.input) log += '| "input" (' + inputName + ') not not found';
        } else if (typeof cfg.input === 'object') {
            input = cfg.input;
        }

        if (cfg.alpha !== undefined) {
            a = cfg.alpha;
        }

        if (cfg.alpha_slider !== undefined) {
            alpha = cfg.alpha_slider;
        }

        if (cfg.input_color !== undefined) {
            inputColor = cfg.input_color;
        }

        if (cfg.input_format !== undefined) {
            inputFormat = cfg.input_format;
        }

        if (cfg.userEvents)
            userEvents = cfg.userEvents;

        if (cfg.place && typeof cfg.place !== 'object') {
            placeName = cfg.place;
            cfg.place = document.getElementById(cfg.place);
        }

        if (cfg.place) {
            place = cfg.place;
        } else if (input) {

            popup.tag = document.createElement('div');
            popup.tag.className = "popup-kelly-color";

            if (!cfg.popupClass) {

                popup.tag.className = "popup-kelly-color";

                popup.tag.style.position = 'absolute';
                popup.tag.style.bottom = '0px';
                popup.tag.style.left = '0px';
                popup.tag.style.display = 'none';
                popup.tag.style.backgroundColor = '#e1e1e1';
                popup.tag.style.border = "1px solid #bfbfbf";
                popup.tag.style.boxShadow = "7px 7px 14px -3px rgba(0,0,0,0.24)";
                popup.tag.style.borderTopLeftRadius = '4px';
                popup.tag.style.borderTopRightRadius = '4px';
                popup.tag.style.borderBottomLeftRadius = '4px';
                popup.tag.style.borderBottomRightRadius = '4px';
                popup.tag.style.padding = "12px";

            } else {
                popup.tag.className = cfg.inputClassName;
            }

            place = popup.tag;

            var body = document.getElementsByTagName('body')[0];
            body.appendChild(popup.tag);

            addEventListner(input, "click", function (e) {
                return handler.popUpShow(e);
            }, 'popup_');

        } // attach directly to input by popup
        else
            criticalError += '| "place" (' + placeName + ') not not found';

        if (cfg.size && cfg.size > 0) {
            wheelBlockSize = cfg.size;
        }

        // hex default #000000
        if (cfg.color)
            hex = cfg.color;
        else if (input && input.value) {
            var colorData = readColorData(input.value);
            hex = colorData.h;
            if (alpha)
                a = colorData.a;
        }

        //if (hex.charAt(0) == '#') hex = hex.slice(1);
        //if (hex.length == 3) hex = hex + hex;
        //if (hex.length !== 6) hex = '#000000';

        if (cfg.method && (cfg.method == 'triangle' || cfg.method == 'quad'))
            method = cfg.method;

        if (!initCanvas()) {
            criticalError += ' | cant init canvas context';
        }

        if (criticalError) {
            if (typeof console !== 'undefined')
                console.log('KellyColorPicker : ' + criticalError);
            return;
        }

        if (method == 'quad')
            svFig = getSvFigureQuad();
        if (method == 'triangle')
            svFig = getSvFigureTriangle();

        if (input) {
            var inputEdit = function (e) {
                var e = e || window.event;
                if (!e.target) {
                    e.target = e.srcElement;
                }
                handler.setColorByHex(e.target.value, true);
            };

            addEventListner(input, "click", inputEdit, 'input_edit_');
            addEventListner(input, "change", inputEdit, 'input_edit_');
            addEventListner(input, "keyup", inputEdit, 'input_edit_');
            addEventListner(input, "keypress", inputEdit, 'input_edit_');
        }

        enableEvents();

        updateSize();
        handler.setColorByHex(false); // update color info and first draw
    }

	// Read color value from string cString in rgb \ rgba \ hex format 
    // falseOnFail = false - return default color #000000 on fail

    function readColorData(cString, falseOnFail) {
        var alpha = 1;
        var h = false;

        cString = cString.trim(cString);
        if (cString.length <= 7) { // hex color
            if (cString.charAt(0) == '#')
                cString = cString.slice(1);

            if (cString.length == 3)
                h = cString + cString;
            else if (cString.length == 6)
                h = cString;

            //if (h && !h.match(/^#([0-9A-F]){3}$|^#([0-9A-F]){6}$/img)) h = false;			

        } else if (cString.substring(0, 3) == 'rgb') {
            var rgba = cString.split(",");

            if (rgba.length >= 3 && rgba.length <= 4) {
                rgba[0] = rgba[0].replace("rgba(", "");
                rgba[0] = rgba[0].replace("rgb(", "");

                var rgb = {r: parseInt(rgba[0]), g: parseInt(rgba[1]), b: parseInt(rgba[2])};

                if (rgb.r <= 255 && rgb.g <= 255 && rgb.b <= 255) {

                    h = rgbToHex(rgb);

                    if (rgba.length == 4) {
                        alpha = parseFloat(rgba[3]);
                        if (!alpha || alpha < 0)
                            alpha = 0;
                        if (alpha > 1)
                            alpha = 1;
                    }
                }
            }
        }

        if (h === false && falseOnFail)
            return false;
        if (h === false)
            h = '000000';

        if (h.charAt(0) != '#')
            h = '#' + h;
        return {h: h, a: alpha};
    }

    function getSvFigureQuad() {
        var quad = new Object;
        quad.size;
        quad.padding = 2;
        quad.path; // крайние точки фигуры на координатной плоскости
        quad.imageData = null; // rendered quad image data
        // перезаписывается существующий, чтобы не вызывать утечек памяти, обнуляя прошлый
        // тк UInt8ClampedArray генерируемый createImageData стандартными способами не
        // во всех браузерах выгружается сразу

        quad.dotToSv = function (dot) {
            return {
                s: Math.abs(this.path[3].x - dot.x) / this.size,
                v: Math.abs(this.path[3].y - dot.y) / this.size
            };
        };

        quad.svToDot = function (sv) {
            var quadX = this.path[0].x;
            var quadY = this.path[0].y;

            var svError = 0.02;
            if (wheelBlockSize < 150) {
                svError = 0.07;
            } else if (wheelBlockSize < 100) {
                svError = 0.16;
            }

            for (var y = 0; y < this.size; y++) {
                for (var x = 0; x < this.size; x++) {
                    var dot = {x: x + quadX, y: y + quadY};
                    var targetSv = this.dotToSv(dot);
                    var es = Math.abs(targetSv.s - sv.s), ev = Math.abs(targetSv.v - sv.v);

                    if (es < svError && ev < svError) {
                        return dot;
                    }
                }
            }

            return {x: 0, y: 0};
        };

        quad.limitDotPosition = function (dot) {
            var x = dot.x;
            var y = dot.y;

            if (x < this.path[0].x) {
                x = this.path[0].x;
            }

            if (x > this.path[0].x + this.size) {
                x = this.path[0].x + this.size;
            }

            if (y < this.path[0].y) {
                y = this.path[0].y;
            }

            if (y > this.path[0].y + this.size) {
                y = this.path[0].y + this.size;
            }

            return {x: x, y: y};
        };

        quad.draw = function () {
            if (!this.imageData)
                this.imageData = ctx.createImageData(this.size, this.size);
            var i = 0;

            var quadX = this.path[0].x;
            var quadY = this.path[0].y;

            for (var y = 0; y < this.size; y++) {
                for (var x = 0; x < this.size; x++) {
                    var dot = {x: x + quadX, y: y + quadY};

                    var sv = this.dotToSv(dot);
                    var targetRgb = hsvToRgb(hsv.h, sv.s, sv.v);
                    this.imageData.data[i + 0] = targetRgb.r;
                    this.imageData.data[i + 1] = targetRgb.g;
                    this.imageData.data[i + 2] = targetRgb.b;
                    this.imageData.data[i + 3] = 255;
                    i += 4;
                }
            }

            ctx.putImageData(this.imageData, quadX, quadY);

            ctx.beginPath();
            ctx.strokeStyle = 'rgba(0,0,0, 0.2)';
            ctx.lineWidth = 2;
            for (var i = 0; i <= this.path.length - 1; ++i)
            {
                if (i == 0)
                    ctx.moveTo(this.path[i].x, this.path[i].y);
                else
                    ctx.lineTo(this.path[i].x, this.path[i].y);
            }

            ctx.stroke();

            ctx.closePath();
        };

        quad.updateSize = function () {
            var workD = (wheel.innerRadius * 2) - wheelCursor.paddingX * 2 - this.padding * 2;

            // исходя из формулы диагонали квадрата, узнаем длинну стороны на основании доступного диаметра
            this.size = Math.floor(workD / Math.sqrt(2));

            this.path = new Array();

            // находим верхнюю левую точку и от нее задаем остальные координаты
            this.path[0] = {x: -1 * (this.size / 2), y: -1 * (this.size / 2)};
            this.path[1] = {x: this.path[0].x + this.size, y: this.path[0].y};
            this.path[2] = {x: this.path[1].x, y: this.path[1].y + this.size};
            this.path[3] = {x: this.path[2].x - this.size, y: this.path[2].y};
            this.path[4] = {x: this.path[0].x, y: this.path[0].y};

            for (var i = 0; i <= this.path.length - 1; ++i) {
                this.path[i].x += wheel.pos.x;
                this.path[i].y += wheel.pos.y;
            }
        }

        quad.isDotIn = function (dot) {
            if (dot.x < this.path[0].x ||
                    dot.x > this.path[0].x + this.size ||
                    dot.y < this.path[0].y ||
                    dot.y > this.path[0].y + this.size) {
                return false;
            }
            return true;
        };

        return quad;
    }

    function getSvFigureTriangle() {
        var triangle = new Object;
        triangle.size; // сторона равностороннего треугольника
        triangle.padding = 2;
        triangle.path;
        triangle.imageData = null; // rendered triangle image data
        triangle.followWheel = true;
        triangle.s;
        triangle.sOnTop = false;
        triangle.outerRadius;

        triangle.limitDotPosition = function (dot) {
            var x = dot.x;
            var y = dot.y;

            var slopeToCtr;
            var maxX = this.path[0].x;
            var minX = this.path[2].x;
            var finalX = x;
            var finalY = y;

            finalX = Math.min(Math.max(minX, finalX), maxX);
            var slope = ((this.path[0].y - this.path[1].y) / (this.path[0].x - this.path[1].x));
            var minY = Math.ceil((this.path[1].y + (slope * (finalX - this.path[1].x))));
            slope = ((this.path[0].y - this.path[2].y) / (this.path[0].x - this.path[2].x));
            var maxY = Math.floor((this.path[2].y + (slope * (finalX - this.path[2].x))));

            if (x < minX) {
                slopeToCtr = ((wheel.pos.y - y) / (wheel.pos.x - x));
                finalY = y;
            }

            finalY = Math.min(Math.max(minY, finalY), maxY);
            return {x: finalX, y: finalY};
        };

        triangle.svToDot = function (sv) {
            var svError = 0.02;
            if (wheelBlockSize < 150) {
                svError = 0.07;
            } else if (wheelBlockSize < 100) {
                svError = 0.16;
            }

            for (var y = 0; y < this.size; y++) {
                for (var x = 0; x < this.size; x++) {
                    var dot = {x: this.path[1].x + x, y: this.path[1].y + y};
                    if (svFig.isDotIn(dot)) {
                        var targetSv = this.dotToSv(dot);
                        var es = Math.abs(targetSv.s - sv.s), ev = Math.abs(targetSv.v - sv.v);

                        if (es < svError && ev < svError) {
                            return dot;
                        }
                    }
                }
            }

            return {
                x: 0,
                y: 0
            };
        };

        triangle.draw = function () {
            if (!this.imageData)
                this.imageData = canvasHelperCtx.createImageData(this.size, this.size);

            canvasHelper.width = this.size;
            canvasHelper.height = this.size;

            var trX = this.path[1].x;
            var trY = this.path[1].y;
            var i = 0;
            for (var y = 0; y < this.size; y++) {
                for (var x = 0; x < this.size; x++) {
                    var dot = {x: this.path[1].x + x, y: this.path[1].y + y};
                    if (!svFig.isDotIn(dot)) {
                        this.imageData.data[i + 0] = 0;
                        this.imageData.data[i + 1] = 0;
                        this.imageData.data[i + 2] = 0;
                        this.imageData.data[i + 3] = 0;
                    } else {
                        var sv = this.dotToSv(dot);
                        var targetRgb = hsvToRgb(hsv.h, sv.s, sv.v);

                        this.imageData.data[i + 0] = targetRgb.r;
                        this.imageData.data[i + 1] = targetRgb.g;
                        this.imageData.data[i + 2] = targetRgb.b;
                        this.imageData.data[i + 3] = 255;
                    }

                    i += 4;
                }
            }

            canvasHelperCtx.putImageData(this.imageData, 0, 0);
            ctx.drawImage(canvasHelper, trX, trY);

            ctx.beginPath();
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.lineWidth = 2;
            var trianglePath = this.path; //rotatePath(triangle.path, hsv.h * 360);
            for (var i = 0; i <= trianglePath.length - 1; ++i)
            {
                if (i == 0)
                    ctx.moveTo(trianglePath[i].x, trianglePath[i].y);
                else
                    ctx.lineTo(trianglePath[i].x, trianglePath[i].y);
            }

            ctx.stroke();
            ctx.closePath();
        };

        triangle.calcS = function (p) {
            return Math.abs((p[1].x - p[0].x) * (p[2].y - p[0].y) - (p[2].x - p[0].x) * (p[1].y - p[0].y)) / 2;
        };

        triangle.dotToSv = function (dot) {
            var p = getP({x: dot.x, y: dot.y}, this.vol);
            var len = getLen(p, this.vol[0]);

            // dirty tricks? replace output to interpolation and lerp in future
            if (len < 1)
                len = Math.floor(len);
            if (len > this.h - 1)
                len = this.h;

            var vol = len / (this.h);

            var angle = Math.abs(getAngle(dot, this.sSide));
            if (angle < 30)
                angle = 30;
            angle -= 30;
            angle = 60 - angle;
            angle = angle / 60; // - saturation from one angle

            return {s: angle, v: vol};
        };

        triangle.isDotIn = function (dot) {
            var t = [
                {x: this.path[0].x, y: this.path[0].y},
                {x: this.path[1].x, y: this.path[1].y},
                {x: dot.x, y: dot.y}
            ];

            var s = this.calcS(t);
            t[1] = {x: this.path[2].x, y: this.path[2].y};
            s += this.calcS(t);
            t[0] = {x: this.path[1].x, y: this.path[1].y};
            s += this.calcS(t);

            if (Math.ceil(s) == Math.ceil(this.s))
                return true;
            else
                return false;
        };

        triangle.updateSize = function () {
            // из формулы высоты равностороннего треугольника
            this.outerRadius = wheel.innerRadius - wheelCursor.paddingX - this.padding;
            // из теоремы синусов треугольника
            this.size = Math.floor((2 * this.outerRadius) * Math.sin(toRadians(60)));

            var h = ((Math.sqrt(3) / 2) * this.size);
            this.h = ((Math.sqrt(3) / 2) * this.size);

            this.path = new Array();
            this.path[0] = {x: this.outerRadius, y: 0}; // middle point - h
            this.path[1] = {x: this.path[0].x - h, y: -1 * (this.size / 2)}; // upper - s
            this.path[2] = {x: this.path[1].x, y: this.size / 2}; // bottom - v
            this.path[3] = {x: this.path[0].x, y: this.path[0].y}; // to begin

            for (var i = 0; i <= this.path.length - 1; ++i) {
                this.path[i].x += wheel.pos.x;
                this.path[i].y += wheel.pos.y;
            }

            this.vol = new Array();


            this.s = this.calcS(this.path);
            if (this.sOnTop) {
                var middle = getMiddlePoint(this.path[0], this.path[2]);

                this.vol[0] = {x: this.path[1].x, y: this.path[1].y};
                this.vol[1] = {x: middle.x, y: middle.y};

                this.sSide = this.path[1];
            } else {
                var middle = getMiddlePoint(this.path[0], this.path[1]);

                this.vol[0] = {x: this.path[2].x, y: this.path[2].y};
                this.vol[1] = {x: middle.x, y: middle.y};

                this.sSide = this.path[2];
            }
        };

        return triangle;
    }

    // prefix - for multiple event functions for one object
    function addEventListner(object, event, callback, prefix) {
        if (typeof object !== 'object') {
            object = document.getElementById(object);
        }

        if (!object)
            return false;
        if (!prefix)
            prefix = '';

        events[prefix + event] = callback;

        if (!object.addEventListener) {
            object.attachEvent('on' + event, events[prefix + event]);
        } else {
            object.addEventListener(event, events[prefix + event]);
        }

        return true;
    }

    function removeEventListener(object, event, prefix) {
        if (typeof object !== 'object') {
            object = document.getElementById(object);
        }

        // console.log('remove :  : ' + Object.keys(events).length);
        if (!object)
            return false;
        if (!prefix)
            prefix = '';

        if (!events[prefix + event])
            return false;

        if (!object.removeEventListener) {
            object.detachEvent('on' + event, events[prefix + event]);
        } else {
            object.removeEventListener(event, events[prefix + event]);
        }

        events[prefix + event] = null;
        return true;
    }

    // [converters]
    // Read more about HSV color model :
    // https://ru.wikipedia.org/wiki/HSV_%28%F6%E2%E5%F2%EE%E2%E0%FF_%EC%EE%E4%E5%EB%FC%29
    // source of converter hsv functions
    // http://axonflux.com/handy-rgb-to-hsl-and-rgb-to-hsv-color-model-c

    function hsvToRgb(h, s, v) {
        var r, g, b, i, f, p, q, t;

        if (h && s === undefined && v === undefined) {
            s = h.s, v = h.v, h = h.h;
        }

        i = Math.floor(h * 6);
        f = h * 6 - i;
        p = v * (1 - s);
        q = v * (1 - f * s);
        t = v * (1 - (1 - f) * s);

        switch (i % 6) {
            case 0:
                r = v, g = t, b = p;
                break;
            case 1:
                r = q, g = v, b = p;
                break;
            case 2:
                r = p, g = v, b = t;
                break;
            case 3:
                r = p, g = q, b = v;
                break;
            case 4:
                r = t, g = p, b = v;
                break;
            case 5:
                r = v, g = p, b = q;
                break;
        }

        return {
            r: Math.floor(r * 255),
            g: Math.floor(g * 255),
            b: Math.floor(b * 255)
        };
    }

    function rgbToHsv(r, g, b) {
        if (r && g === undefined && b === undefined) {
            g = r.g, b = r.b, r = r.r;
        }

        r = r / 255, g = g / 255, b = b / 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b);
        var h, s, v = max;

        var d = max - min;
        s = max == 0 ? 0 : d / max;

        if (max == min) {
            h = 0; // achromatic
        } else {
            switch (max) {
                case r:
                    h = (g - b) / d + (g < b ? 6 : 0);
                    break;
                case g:
                    h = (b - r) / d + 2;
                    break;
                case b:
                    h = (r - g) / d + 4;
                    break;
            }
            h /= 6;
        }

        return {h: h, s: s, v: v};
    }

    function hexToRgb(hex) {
        var dec = parseInt(hex.charAt(0) == '#' ? hex.slice(1) : hex, 16);
        return {r: dec >> 16, g: dec >> 8 & 255, b: dec & 255};
    }

    function rgbToHex(color) {
        var componentToHex = function (c) {
            var hex = c.toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        };

        return "#" + componentToHex(color.r) + componentToHex(color.g) + componentToHex(color.b);
    }

    function toRadians(i) {
        return i * (PI / 180);
    }

    // [converters - end]

    function getLen(point1, point2) {
        return Math.sqrt(Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2));
    }

    function getMiddlePoint(point1, point2) {
        return {x: (point1.x + point2.x) / 2, y: (point1.y + point2.y) / 2};
    }

    // перпендикуляр от точки

    function getP(point1, line1) {
        var l = (line1[0].x - line1[1].x) * (line1[0].x - line1[1].x) + (line1[0].y - line1[1].y) * (line1[0].y - line1[1].y);
        var pr = (point1.x - line1[0].x) * (line1[1].x - line1[0].x) + (point1.y - line1[0].y) * (line1[1].y - line1[0].y);
        var pt = true;
        var cf = pr / l;

        if (cf < 0) {
            cf = 0;
            pt = false;
        }
        if (cf > 1) {
            cf = 1;
            pt = false;
        }

        return {
            x: line1[0].x + cf * (line1[1].x - line1[0].x),
            y: line1[0].y + cf * (line1[1].y - line1[0].y),
            pt: pt
        };
    }

    // translate360 = true  270
    //            180 --- from.x.y --- 0
    //                      90

    function getAngle(point, from, translate360) {
        if (!from)
            from = {x: 0, y: 0};

        var distX = point.x - from.x;
        var distY = point.y - from.y;

        var a = Math.atan2(distY, distX) * 180 / (PI);
        if (translate360 && a < 0)
            a = 360 + a;

        return a;
    }

    // поворот фигуры относительно точки
    function rotatePath2(points, angle) {
        angle = toRadians(angle);
        var newPoints = new Array();

        for (var i = 0; i <= points.length - 1; ++i)
        {
            newPoints[i] = {
                x: points[i].x * Math.cos(angle) - points[i].y * Math.sin(angle),
                y: points[i].x * Math.sin(angle) + points[i].y * Math.cos(angle)
            };
        }

        return newPoints;
    }

    function updateSize() {
        padding = basePadding + wheelCursor.paddingX;

        rendered = false;
        wheel.imageData = null;

        center = wheelBlockSize / 2;
        wheel.pos = {x: center, y: center};

        wheel.outerRadius = center - padding;
        wheel.innerRadius = wheel.outerRadius - wheel.width;

        // объект относительно начала координат
        wheelCursor.path = [
            {x: wheel.innerRadius - wheelCursor.paddingX, y: wheelCursor.height * -1},
            {x: wheel.outerRadius + wheelCursor.paddingX, y: wheelCursor.height * -1},
            {x: wheel.outerRadius + wheelCursor.paddingX, y: wheelCursor.height},
            {x: wheel.innerRadius - wheelCursor.paddingX, y: wheelCursor.height},
            {x: wheel.innerRadius - wheelCursor.paddingX, y: wheelCursor.height * -1}
        ];

        var width = wheelBlockSize;
        if (alpha)
            width += alphaSlider.width + alphaSlider.padding * 2;

        if (place.tagName != 'CANVAS') {
            place.style.width = width + 'px';
            place.style.height = wheelBlockSize + 'px';
        }

        canvas.width = width;
        canvas.height = wheelBlockSize;

        svFig.updateSize();
        if (alpha)
            alphaSlider.updateSize();
    }

    // updates input after color changes (manualEnter = true if value entered from input, not from widget)
    // if manualEnter = true - save original text in input, else set input value in configurated format
    // if user event 'updateinput' is setted and return false - prevent default updateInput behavior

    function updateInput(manualEnter) {
        if (!input)
            return;

        if (userEvents["updateinput"]) {
            var callback = userEvents["updateinput"];
            if (!callback(handler, input, manualEnter)) return;
        }

        var rgba = 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + a.toFixed(2) + ')';

        if (!manualEnter) {
            if (a < 1 && inputFormat === 'mixed') {
                input.value = rgba;
            } else {
                if (inputFormat === 'hex' || inputFormat === 'mixed')
                    input.value = hex;
                else
                    input.value = rgba;
            }
        }

        if (inputColor) {
            if (hsv.v < 0.5) {
                input.style.color = "#FFF";
            } else {
                input.style.color = "#000";
            }

            input.style.background = rgba;
        }
    }

    function initCanvas() {
        if (!place)
            return false;
        if (place.tagName != 'CANVAS') {
            canvas = document.createElement('CANVAS');
            place.appendChild(canvas);
        } else {
            canvas = place;
        }

        // code for IE browsers
        if (typeof window.G_vmlCanvasManager != 'undefined') {
            canvas = window.G_vmlCanvasManager.initElement(canvas);
            canvasHelper = window.G_vmlCanvasManager.initElement(canvasHelper);
        }

        if (!!(canvas.getContext && canvas.getContext('2d'))) {
            ctx = canvas.getContext("2d");
            canvasHelperCtx = canvasHelper.getContext("2d");
            return true;
        } else
            return false;
    }

    // temp events until wait mouse click or touch
    function enableEvents() {
        addEventListner(canvas, "mousedown", function (e) {
            handler.mouseDownEvent(e);
        }, 'wait_action_');
        addEventListner(canvas, "touchstart", function (e) {
            handler.mouseDownEvent(e);
        }, 'wait_action_');
        addEventListner(canvas, "mouseout", function (e) {
            handler.mouseOutEvent(e);
        }, 'wait_action_');
        addEventListner(window, "touchmove", function (e) {
            handler.touchMoveEvent(e);
        }, 'wait_action_');
        addEventListner(canvas, "mousemove", function (e) {
            handler.mouseMoveRest(e);
        }, 'wait_action_');
    }

    function disableEvents() {
        removeEventListener(canvas, "mousedown", 'wait_action_');
        removeEventListener(canvas, "touchstart", 'wait_action_');
        removeEventListener(canvas, "mouseout", 'wait_action_');
        removeEventListener(window, "touchmove", 'wait_action_');
        removeEventListener(canvas, "mousemove", 'wait_action_');
    }

    function getEventDot(e) {
        e = e || window.event;
        var x, y;
        var scrollX = document.body.scrollLeft + document.documentElement.scrollLeft;
        var scrollY = document.body.scrollTop + document.documentElement.scrollTop;

        if (e.touches) {
            x = e.touches[0].clientX + scrollX;
            y = e.touches[0].clientY + scrollY;
        } else {
            // e.pageX e.pageY e.x e.y bad for cross-browser
            x = e.clientX + scrollX;
            y = e.clientY + scrollY;
        }

        var rect = canvas.getBoundingClientRect();
        x -= rect.left + scrollX;
        y -= rect.top + scrollY;

        return {x: x, y: y};
    }

    // вывод интерфейса без курсоров
    // поддерживается буферизация todo добавить буферизацию альфа бара

    function drawColorPicker() {
        if (!ctx)
            return false;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (rendered) {
            ctx.putImageData(canvasHelperData, 0, 0);

            if (alpha)
                alphaSlider.draw();
            return true;
        }

        // форма кольца может измениться только при изменении размеров виджета
        wheel.draw();
        svFig.draw();

        if (alpha)
            alphaSlider.draw();

        // поместить текущее отрисованное изображение в буфер
        // notice :
        // при перемещении курсора кольца сохранять буфер все изображение бессмысленно - sv блок постоянно обновляется, поэтому
        // сохраняем уже на событии выхода из процесса перемещения

        if (!drag) {
            canvasHelperData = ctx.getImageData(0, 0, wheelBlockSize, wheelBlockSize);
            rendered = true;
        }
        return true;
    }

    function draw() {
        if (!drawColorPicker()) {
            return false;
        }

        var curAngle = hsv.h * 360 - wheel.startAngle;

        // cursors

        if (alpha) {
            ctx.beginPath();
            var cursorHeight = 2;
            var cursorPaddingX = 2;
            var pointY = alphaSlider.height * (1 - a);
            ctx.rect(alphaSlider.pos.x - cursorPaddingX, alphaSlider.padding + pointY - cursorHeight / 2, alphaSlider.width + cursorPaddingX * 2, cursorHeight);
            ctx.strokeStyle = 'rgba(0,0,0, 0.8)';
            ctx.lineWidth = 2;

            ctx.stroke();
            ctx.closePath();
        }

        ctx.beginPath();

        var wheelCursorPath = rotatePath2(wheelCursor.path, curAngle, {x: wheel.pos.x, y: wheel.pos.y});
        for (var i = 0; i <= wheelCursorPath.length - 1; ++i)
        {
            wheelCursorPath[i].x += wheel.pos.x;
            wheelCursorPath[i].y += wheel.pos.y;
            if (i == 0)
                ctx.moveTo(wheelCursorPath[i].x, wheelCursorPath[i].y);
            else
                ctx.lineTo(wheelCursorPath[i].x, wheelCursorPath[i].y);
        }

        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = wheelCursor.lineWeight;
        ctx.stroke();
        ctx.closePath();

        // sv cursor
        if (hsv.v > 0.5 && hsv.s < 0.5)
            ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
        else
            ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
        //ctx.strokeStyle='rgba(255,255, 255, 1)';

        //document.getElementById('test3').value = 'h' + hsv.h.toFixed(2) + ' s'  + hsv.s.toFixed(2) + ' v'  + hsv.v.toFixed(2)

        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.arc(hsv.x, hsv.y, svCursor.radius, 0, PI * 2);


        ctx.stroke();
        ctx.closePath();

        return false;
    }

    this.popUpClose = function (e) {
        if (popup.tag === false)
            return;

        if (e) {
            // todo check when select color and then unpress button out of bounds
            if (e.target == input || e.target == canvas)
                return false;
            if (e.target == popup.tag)
                return false;
        }

        popup.tag.style.display = 'none';
        if (KellyColorPicker.activePopUp == handler)
            KellyColorPicker.activePopUp = false;
    }

	// if 'popupshow' user event is setted and return false - prevent show popup default behavior
	
    this.popUpShow = function (e) {
        if (popup.tag === false)
            return;
			
        if (userEvents["popupshow"]) {
            var callback = userEvents["popupshow"];
            if (!callback(handler, e)) return;
        }
		
        // include once 
        if (!KellyColorPicker.popupEventsInclude) {
            addEventListner(document, "click", function (e) {
                if (KellyColorPicker.activePopUp)
                    return KellyColorPicker.activePopUp.popUpClose(e);
                else
                    return false;
            }, 'popup_close_');
            addEventListner(window, "resize", function (e) {
                if (KellyColorPicker.activePopUp)
                    return KellyColorPicker.activePopUp.popUpShow(e);
            }, 'popup_resize_');
            KellyColorPicker.popupEventsInclude = true;
        }

        if (KellyColorPicker.activePopUp) {
            KellyColorPicker.activePopUp.popUpClose(false);
        }

        var topMargin = handler.getCanvas().width;

        var alpha = handler.getAlphaFig();
        if (alpha) {
            topMargin -= alpha.width + alpha.padding;
        }

        var paddingPopup = parseInt(popup.tag.style.paddingBottom) + parseInt(popup.tag.style.paddingTop);
        if (paddingPopup <= 0) {
            paddingPopup = 0;
        }

        var viewportOffset = input.getBoundingClientRect();
        var top = viewportOffset.top + (window.scrollY || window.pageYOffset || document.body.scrollTop) - paddingPopup;
        var left = viewportOffset.left + (window.scrollX || window.pageXOffset || document.body.scrollLeft);
        var padding = 6;

        popup.tag.style.top = (top - topMargin - popup.margin) + 'px';
        popup.tag.style.left = left + 'px';
        popup.tag.style.display = 'block';

        KellyColorPicker.activePopUp = handler;
        return false;
    }

    this.setHueByDot = function (dot) {
        var angle = getAngle(dot, wheel.pos) + wheel.startAngle;
        if (angle < 0)
            angle = 360 + angle;

        hsv.h = angle / 360;

        rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
        hex = rgbToHex(rgb);

        if (userEvents["change"]) {
            var callback = userEvents["change"];
            callback(handler);
        }

        updateInput();

        rendered = false;
        draw();
    };

    // update color with redraw canvas and update input hex value
    // now support rgba \ rgb string format input

    this.setColorByHex = function (inputHex, manualEnter) {

        if (!manualEnter)
            manualEnter = false;
        var inputAlpha = a;

        if (inputHex !== false) {

            if (!inputHex || !inputHex.length)
                return;

            var colorData = readColorData(inputHex, true);
            if (!colorData)
                return;

            inputHex = colorData.h;
            if (alpha)
                inputAlpha = colorData.a;

        } else
            inputHex = hex;

        if (alpha && inputHex == hex && rendered && inputAlpha != a) {
            a = inputAlpha;

            draw(); // slider always redraws in current even if part of canvas buffered
            return;
        }

        if (hex && inputHex == hex && rendered)
            return;

        // set and redraw all

        a = inputAlpha;
        rgb = hexToRgb(inputHex);
        hex = inputHex;
        hsv = rgbToHsv(rgb);

        var dot = svFig.svToDot(hsv);
        hsv.x = dot.x;
        hsv.y = dot.y;

        rendered = false;
        draw();

        if (userEvents["change"]) {
            var callback = userEvents["change"];
            callback(handler);
        }

        updateInput(manualEnter);
    };

    this.setAlphaByDot = function (dot) {
        a = alphaSlider.dotToAlpha(dot);

        if (userEvents["change"]) {
            var callback = userEvents["change"];
            callback(handler);
        }

        updateInput();
        draw();
    };

    this.setAlpha = function (alpha) {
        a = alpha;
        updateInput();
        draw();
    };

    this.setColorByDot = function (dot) {
        var sv = svFig.dotToSv(dot);

        hsv.s = sv.s;
        hsv.v = sv.v;
        hsv.x = dot.x;
        hsv.y = dot.y;

        if (hsv.s > 1)
            hsv.s = 1;
        if (hsv.s < 0)
            hsv.s = 0;
        if (hsv.v > 1)
            hsv.v = 1;
        if (hsv.v < 0)
            hsv.v = 0;

        rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
        hex = rgbToHex(rgb);

        if (userEvents["change"]) {
            var callback = userEvents["change"];
            callback(handler);
        }

        updateInput();
        draw();
    };

    this.mouseOutEvent = function (e) {
        if (svCursorMouse.curType > 0 && !KellyColorPicker.cursorLock) {
            svCursorMouse.initStandartCursor();
        }
    };

    // перемещение указателя по canvas в режиме покоя
    this.mouseMoveRest = function (e) {
        if (drag)
            return;

        if (!cursorAnimReady) {
            return;
        }

        cursorAnimReady = false;
        var newDot = getEventDot(e);
        svCursorMouse.updateCursor(newDot);
        requestAnimationFrame(function () {
            cursorAnimReady = true;
        });

        if (userEvents["mousemoverest"]) {
            var callback = userEvents["mousemoverest"];
            callback(e, handler, newDot);
        }
    };

    // to prevent scroll by touches while change color
    // в FireFox под андройд есть "фича" которая скрывает или раскрывает тулбар адресной строки при движении пальцем
    // отключить её можно только через опцию about:config browser.chrome.dynamictoolbar

    this.touchMoveEvent = function (e) {
        if (drag) { // todo check number of touches to ignore zoom action
            event.preventDefault();
        }
    };

    // маршрутизатор событий нажатий на элементы
    this.mouseDownEvent = function (event) {
        event.preventDefault();

        var move, up = false;
        var newDot = getEventDot(event);
        // console.log('mouseDownEvent : cur : ' + newDot.x + ' | ' + newDot.y);

        if (wheel.isDotIn(newDot)) {
            drag = 'wheel';
            handler.setHueByDot(newDot);

            move = function (e) {
                handler.wheelMouseMove(e, newDot);
            };
            up = function (e) {
                KellyColorPicker.cursorLock = false;
                handler.wheelMouseUp(e, newDot);
            };

        } else if (svFig.isDotIn(newDot)) {
            drag = 'sv';
            handler.setColorByDot(newDot);

            move = function (e) {
                handler.svMouseMove(e, newDot);
            };
            up = function (e) {
                KellyColorPicker.cursorLock = false;
                handler.svMouseUp(e, newDot);
            };
        } else if (alpha && alphaSlider.isDotIn(newDot)) {
            drag = 'alpha';
            handler.setAlphaByDot(newDot);

            move = function (e) {
                handler.alphaMouseMove(e, newDot);
            };
            up = function (e) {
                KellyColorPicker.cursorLock = false;
                handler.alphaMouseUp(e, newDot);
            };
        }

        if (move && up) {
            disableEvents();
            KellyColorPicker.cursorLock = handler;
            addEventListner(document, "mouseup", up, 'action_process_');
            addEventListner(document, "mousemove", move, 'action_process_');
            addEventListner(document, "touchend", up, 'action_process_');
            addEventListner(document, "touchmove", move, 'action_process_');
        }
    };

    this.wheelMouseMove = function (event, dot) {
        event.preventDefault();

        if (!drag)
            return;

        if (!cursorAnimReady) {
            return;
        }
        cursorAnimReady = false;
        var newDot = getEventDot(event);

        // console.log('wheelMouseMove : start : ' + dot.x + ' | ' + dot.y + ' cur : ' + newDot.x + ' | ' + newDot.y);
        requestAnimationFrame(function () {
            cursorAnimReady = true;
        });
        //setTimeout(function() {cursorAnimReady = true;}, 1000/30);

        handler.setHueByDot(newDot);

        if (userEvents["mousemoveh"]) {
            var callback = userEvents["mousemoveh"];
            callback(event, handler, newDot);
        }
    };

    this.wheelMouseUp = function (event, dot) {
        event.preventDefault();
        if (!drag)
            return;
        //console.log('wheelMouseUp : start : ' + dot.x + ' | ' + dot.y);

        removeEventListener(document, "mouseup", 'action_process_');
        removeEventListener(document, "mousemove", 'action_process_');
        removeEventListener(document, "touchend", 'action_process_');
        removeEventListener(document, "touchmove", 'action_process_');

        enableEvents();
        drag = false;

        rendered = false;
        draw();

        var newDot = getEventDot(event);
        svCursorMouse.updateCursor(newDot);

        if (userEvents["mouseuph"]) {
            var callback = userEvents["mouseuph"];
            callback(event, handler, newDot);
        }
    };

    this.alphaMouseMove = function (event, dot) {
        event.preventDefault();
        if (!drag)
            return;

        if (!cursorAnimReady) {
            return;
        }

        cursorAnimReady = false;
        var newDot = getEventDot(event);

        // console.log('svMouseMove : start : ' + dot.x + ' | ' + dot.y + ' cur : ' + newDot.x + ' | ' + newDot.y);

        newDot = alphaSlider.limitDotPosition(newDot);

        requestAnimationFrame(function () {
            cursorAnimReady = true;
        });
        //setTimeout(function() {cursorAnimReady = true;}, 1000/30);

        handler.setAlphaByDot(newDot);

        if (userEvents["mousemovealpha"]) {
            var callback = userEvents["mousemovealpha"];
            callback(event, handler, newDot);
        }
    };

    this.alphaMouseUp = function (event, dot) {
        event.preventDefault();
        if (!drag)
            return;

        removeEventListener(document, "mouseup", 'action_process_');
        removeEventListener(document, "mousemove", 'action_process_');
        removeEventListener(document, "touchend", 'action_process_');
        removeEventListener(document, "touchmove", 'action_process_');

        enableEvents();
        drag = false;

        var newDot = getEventDot(event);
        svCursorMouse.updateCursor(newDot);

        if (userEvents["mouseupalpha"]) {
            var callback = userEvents["mouseupalpha"];
            callback(event, handler, newDot);
        }
    };

    this.svMouseMove = function (event, dot) {
        event.preventDefault();
        if (!drag)
            return;

        if (!cursorAnimReady) {
            return;
        }

        cursorAnimReady = false;
        var newDot = getEventDot(event);

        // console.log('svMouseMove : start : ' + dot.x + ' | ' + dot.y + ' cur : ' + newDot.x + ' | ' + newDot.y);

        newDot = svFig.limitDotPosition(newDot);

        requestAnimationFrame(function () {
            cursorAnimReady = true;
        });
        //setTimeout(function() {cursorAnimReady = true;}, 1000/30);

        handler.setColorByDot(newDot);

        if (userEvents["mousemovesv"]) {
            var callback = userEvents["mousemovesv"];
            callback(event, handler, newDot);
        }
    };

    this.svMouseUp = function (event, dot) {
        event.preventDefault();
        if (!drag)
            return;

        // console.log('svMouseUp : start : ' + dot.x + ' | ' + dot.y);

        removeEventListener(document, "mouseup", 'action_process_');
        removeEventListener(document, "mousemove", 'action_process_');
        removeEventListener(document, "touchend", 'action_process_');
        removeEventListener(document, "touchmove", 'action_process_');

        enableEvents();
        drag = false;

        var newDot = getEventDot(event);
        svCursorMouse.updateCursor(newDot);

        if (userEvents["mouseupsv"]) {
            var callback = userEvents["mouseupsv"];
            callback(event, handler, newDot);
        }
    };

    this.addUserEvent = function (event, callback) {
        userEvents[event] = callback;
        return true;
    };

    this.removeUserEvent = function (event) {
        if (!userEvents[event])
            return false;
        userEvents[event] = null;
        return true;
    };

    // для кастомизации отображения элементов виджета

    this.getCanvas = function () {
        if (!ctx)
            return false;
        return canvas;
    };

    this.getCtx = function () {
        if (!ctx)
            return false;
        return ctx;
    };

    this.getInput = function () {
        return input;
    };
    this.getSvFig = function () {
        return svFig;
    };
    this.getSvFigCursor = function () {
        return svCursor;
    };

    this.getWheel = function () {
        return wheel;
    };
    this.getWheelCursor = function () {
        return wheelCursor;
    };

    this.getCurColorHsv = function () {
        return hsv;
    };
    this.getCurColorRgb = function () {
        return rgb;
    };
    this.getCurColorHex = function () {
        return hex;
    };
    this.getCurColorRgba = function () {
        return {r: rgb.r, g: rgb.g, b: rgb.b, a: a};
    };
    this.getCurAlpha = function () {
        return a;
    };
    this.getAlphaFig = function () {
        if (alpha)
            return alphaSlider;
        else
            return false;
    }

    this.getPopup = function () {
        return popup;
    };
    this.getSize = function () {
        return wheelBlockSize;
    };

    this.updateView = function (dropBuffer) {
        if (!ctx)
            return false;

        if (dropBuffer) {
            wheel.imageData = null;
            svFig.imageData = null;
            canvasHelperData = null;
        }

        rendered = false;
        updateSize();
        draw();
        return true;
    };

    this.resize = function (size) {
        if (!ctx)
            return false;
        if (size == wheelBlockSize)
            return true;

        rendered = false;
        wheel.imageData = null;
        svFig.imageData = null;
        canvasHelperData = null;
        wheelBlockSize = size;
        updateSize();

        handler.setColorByHex(false);
        return false;
    };

    // restore color of input ? 

    this.destroy = function () {
        if (svCursorMouse.curType > 0) {
            KellyColorPicker.cursorLock = false;
            svCursorMouse.initStandartCursor();
        }

        if (drag) {
            removeEventListener(document, "mouseup", 'action_process_');
            removeEventListener(document, "mousemove", 'action_process_');
            removeEventListener(document, "touchend", 'action_process_');
            removeEventListener(document, "touchmove", 'action_process_');

            drag = false;
        }

        if (popup.tag) {
            removeEventListener(input, "click", "popup_");
        }

        if (input) {
            removeEventListener(input, "click", 'input_edit_');
            removeEventListener(input, "change", 'input_edit_');
            removeEventListener(input, "keyup", 'input_edit_');
            removeEventListener(input, "keypress", 'input_edit_');
        }

        // remove popup close and resize events if this picker include them erlier
        if (KellyColorPicker.popupEventsInclude && events['popup_close_click']) {
            if (KellyColorPicker.activePopUp)
                KellyColorPicker.activePopUp.popUpClose(false);

            removeEventListener(document, "click", 'popup_close_');
            removeEventListener(window, "resize", 'popup_resize_');

            KellyColorPicker.popupEventsInclude = false;
        }

        wheel.imageData = null;
        svFig.imageData = null;
        canvasHelperData = null;
        canvasHelper = null;

        if (place && place.parentNode) {
            place.parentNode.removeChild(place);
        }

        disableEvents(); // remove canvas events		

        // debug test for check is all events removed 
        // for (var key in events) {
        // 	console.log('key : ' +  key + ' data ' + events[key]);
        // }

        handler = null;
    };

    constructor(cfg);
}

/* static methods */

/**
 * Тригер для объектов KellyColorPicker, чтобы не сбрасывали стиль курсора при наведении если уже идет выбор цвета
 * Notice : при выходе курсора за границы текущего canvas, событие неизвестного объекта всегда может сбросить изображение курсора
 */

KellyColorPicker.cursorLock = false; // можно указывать handler объекта
KellyColorPicker.activePopUp = false;
KellyColorPicker.popupEventsInclude = false; // include events for document and window once for all elements

KellyColorPicker.attachToInputByClass = function (className, cfg) {

    var colorPickers = new Array();
    var inputs = document.getElementsByClassName(className);


    for (var i = 0; i < inputs.length; i++) {

        if (cfg)
            cfg.input = inputs[i];
        else
            cfg = {input: inputs[i], size: 150};

        colorPickers.push(new KellyColorPicker(cfg));
    }

    return colorPickers;
};

// KellyColorPicker.dragTrigger = false;
