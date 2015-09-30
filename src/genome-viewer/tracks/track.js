/*
 * Copyright (c) 2012 Francisco Salavert (ICM-CIPF)
 * Copyright (c) 2012 Ruben Sanchez (ICM-CIPF)
 * Copyright (c) 2012 Ignacio Medina (ICM-CIPF)
 *
 * This file is part of JS Common Libs.
 *
 * JS Common Libs is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * JS Common Libs is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with JS Common Libs. If not, see <http://www.gnu.org/licenses/>.
 */

function Track(args) {

    // Using Underscore 'extend' function to extend and add Backbone Events
    _.extend(this, Backbone.Events);

    this.id = Utils.genId("Track");
    this.title;

    this.targetId;
    this.width = 200;
    this.height = 100;
    this.dataAdapter;
    this.renderer;
    this.resizable = true;
    this.autoHeight = false;
    this.minHistogramRegionSize = 300000000; // 300Mnt
    this.maxLabelRegionSize = 300000000; // 300Mnt
    this.visibleRegionSize;
    this.fontClass = 'ocb-font-sourcesanspro ocb-font-size-14';

    _.extend(this, args);


    this.pixelBase;
    this.svgCanvasWidth = 500000;//mesa
    this.pixelPosition = this.svgCanvasWidth / 2;
    this.svgCanvasOffset;
    this.svgCanvasFeatures;
    this.status;
    this.histogram;
    this.histogramLogarithm;
    this.histogramMax;
    this.interval;

    this.svgCanvasLeftLimit;
    this.svgCanvasRightLimit;


    this.invalidZoomText;

    this.renderedArea = {};//used for renders to store binary trees
    this.chunksDisplayed = {};//used to avoid painting multiple times features contained in more than 1 chunk

    this.on(this.handlers);

    this.rendered = false;
    if (this.autoRender) {
        this.render();
    }
};

Track.prototype = {

    get: function (attr) {
        return this[attr];
    },
    set: function (attr, value) {
        this[attr] = value;
    },
    hide: function () {
        $(this.div).css({display: 'none'});
        this.trigger('track:hide', {sender: this});
    },
    show: function () {
        $(this.div).css({display: 'inherit'});
        this.trigger('track:show', {sender: this});
    },
    hideContent: function (completely) {
        $(this.svgdiv).css({display: 'none'});
        if (completely) {
            $(this.titlediv).css({display: 'none'});
        } else {
            $(this.resizeDiv).css({display: 'none'});
            $(this.configBtn).css({display: 'none'});
        }
        this.trigger('track:hideContent', {sender: this});
    },
    showContent: function (completely) {
        $(this.svgdiv).css({display: 'inherit'});
        if (completely) {
            $(this.titlediv).css({display: 'inherit'});
        } else {
            $(this.resizeDiv).css({display: 'inherit'});
            $(this.configBtn).css({display: 'inherit'});
        }
        this.trigger('track:showContent', {sender: this});
    },
    toggleContent: function () {
        var hidden = $(this.svgdiv).css('display') == 'none';
        if (hidden) {
            this.showContent();
        } else {
            this.hideContent();
        }
    },
    setSpecies: function (species) {
        this.species = species;
        this.dataAdapter.species = this.species
        this.trigger('track:speciesChanged', {sender: this});
    },

    setWidth: function (width) {
        this.width = width;
        this.main.setAttribute("width", width);
    },
    _updateDIVHeight: function () {
        if (this.resizable) {
            if (this.histogram) {
                $(this.svgdiv).css({'height': this.height + 10});
            } else {
                var x = this.pixelPosition;
                var width = this.width;
                var lastContains = 0;
                for (var i in this.renderedArea) {
                    if (this.renderedArea[i].contains({start: x, end: x + width })) {
                        lastContains = i;
                    }
                }
                var divHeight = parseInt(lastContains) + 20;
                $(this.svgdiv).css({'height': divHeight + 25});
            }
        }
    },
    _updateSVGHeight: function () {
        if (this.resizable && !this.histogram) {
            var renderedHeight = Object.keys(this.renderedArea).length * 20;//this must be passed by config, 20 for test
            this.main.setAttribute('height', renderedHeight);
            this.svgCanvasFeatures.setAttribute('height', renderedHeight);
            this.hoverRect.setAttribute('height', renderedHeight);
        }
    },
    updateHeight: function (ignoreAutoHeight) {
        this._updateSVGHeight();
        if (this.autoHeight || ignoreAutoHeight) {
            this._updateDIVHeight();
        }
        this.trigger('track:updateHeight', {sender: this});
    },
    enableAutoHeight: function () {
        this.autoHeight = true;
        this.updateHeight();
    },
    setTitle: function (title) {
        $(this.titlediv).html(title);
    },

    setLoading: function (bool) {
        if (bool) {
            this.svgLoading.setAttribute("visibility", "visible");
            this.status = "rendering";
        } else {
            this.svgLoading.setAttribute("visibility", "hidden");
            this.status = "ready";
            this.trigger('track:ready', {sender: this});
        }
    },

    updateHistogramParams: function () {
        if (this.region.length() > this.minHistogramRegionSize) {
            this.histogram = true;
            this.histogramLogarithm = true;
            this.histogramMax = 500;
            this.interval = Math.ceil(10 / this.pixelBase);//server interval limit 512
        } else {
            this.histogram = undefined;
            this.histogramLogarithm = undefined;
            this.histogramMax = undefined;
            this.interval = undefined;
        }
    },

    cleanSvg: function (filters) {//clean
        while (this.svgCanvasFeatures.firstChild) {
            this.svgCanvasFeatures.removeChild(this.svgCanvasFeatures.firstChild);
        }
        this.chunksDisplayed = {};
        this.renderedArea = {};
    },

    initializeDom: function (targetId) {

        var _this = this;
        var div = $('<div id="' + this.id + '-div"></div>')[0];
        var titleBardiv = $(
            '<div class="gvtrack-titlebardiv">' +
            '<div class="btn-group btn-group-xs">' +
            '<button id="' + this.id + 'configBtn" type="button" class="gvtrack-config-btn btn btn-xs btn-primary">' +
            '<span class="glyphicon glyphicon-cog"></span></button>' +
            '<button id="' + this.id + 'titleBtn" type="button" class="gvtrack-title-btn btn btn-xs btn-default" data-toggle="button">' +
            '<span id="' + this.id + 'titleDiv" class="gvtrack-title-div">' + this.title + '</span></button>' +
            '</div>' +
            '</div>')[0];

        if (_.isUndefined(this.title)) {
            $(titleBardiv).addClass("hidden");
        }

        var titlediv = $(titleBardiv).find('.gvtrack-title-div')[0];
        var titleBtn = $(titleBardiv).find('.gvtrack-title-btn')[0];
        var configBtn = $(titleBardiv).find('.gvtrack-config-btn')[0];

        var svgdiv = $('<div id="' + this.id + '-svgdiv" class="gvtrack-svgdiv"></div>')[0];
        var resizediv = $('<div id="' + this.id + '-resizediv" class="ocb-track-resize"></div>')[0];

        $(targetId).addClass("unselectable");
        $(targetId).append(div);
        $(div).append(titleBardiv);
        $(div).append(svgdiv);
        $(div).append(resizediv);


        /** title div **/
        $(titleBardiv).on('dblclick', function (e) {
            e.stopPropagation();
        });
        $(titleBtn).click(function (e) {
            _this.toggleContent();
        });

        /** svg div **/
        $(svgdiv).css({'height': this.height});

        var main = SVG.addChild(svgdiv, 'svg', {
            'id': this.id,
            'class': 'trackSvg',
            'x': 0,
            'y': 0,
            'width': this.width,
            'height': this.height
        });


        if (this.resizable) {
            $(resizediv).mousedown(function (event) {
                $('html').addClass('unselectable');
                event.stopPropagation();
                var downY = event.clientY;
                $('html').bind('mousemove.genomeViewer', function (event) {
                    var despY = (event.clientY - downY);
                    var actualHeight = $(svgdiv).outerHeight();
                    $(svgdiv).css({height: actualHeight + despY});
                    downY = event.clientY;
                    _this.autoHeight = false;
                });
            });
            $('html').bind('mouseup.genomeViewer', function (event) {
                $('html').removeClass('unselectable');
                $('html').off('mousemove.genomeViewer');
            });
            $(svgdiv).closest(".trackListPanels").mouseup(function (event) {
                _this.updateHeight();
            });


            $(resizediv).mouseenter(function (event) {
                $(this).css({'cursor': 'ns-resize'});
                $(this).css({'opacity': 1});
            });
            $(resizediv).mouseleave(function (event) {
                $(this).css({'cursor': 'default'});
                $(this).css({'opacity': 0.3});
            });

        }

        this.svgGroup = SVG.addChild(main, "g", {
        });

        var text = this.title;
        var hoverRect = SVG.addChild(this.svgGroup, 'rect', {
            'x': 0,
            'y': 0,
            'width': this.width,
            'height': this.height,
            'opacity': '0.6',
            'fill': 'transparent'
        });

        this.svgCanvasFeatures = SVG.addChild(this.svgGroup, 'svg', {
            'class': 'features',
            'x': -this.pixelPosition,
            'width': this.svgCanvasWidth,
            'height': this.height
        });


        this.fnTitleMouseEnter = function () {
            hoverRect.setAttribute('opacity', '0.1');
            hoverRect.setAttribute('fill', 'lightblue');
        };
        this.fnTitleMouseLeave = function () {
            hoverRect.setAttribute('opacity', '0.6');
            hoverRect.setAttribute('fill', 'transparent');
        };

        $(this.svgGroup).off('mouseenter');
        $(this.svgGroup).off('mouseleave');
        $(this.svgGroup).mouseenter(this.fnTitleMouseEnter);
        $(this.svgGroup).mouseleave(this.fnTitleMouseLeave);


        this.invalidZoomText = SVG.addChild(this.svgGroup, 'text', {
            'x': 154,
            'y': 18,
            'opacity': '0.6',
            'fill': 'black',
            'visibility': 'hidden',
            'class': this.fontClass
        });
        this.invalidZoomText.textContent = "Zoom in to view the sequence";


        var loadingImg =
            '<?xml version="1.0" encoding="utf-8"?>' +
            '<svg version="1.1" width="22px" height="22px" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
            '<defs>' +
            '<g id="pair">' +
            '<ellipse cx="7" cy="0" rx="4" ry="1.7" style="fill:#ccc; fill-opacity:0.5;"/>' +
            '<ellipse cx="-7" cy="0" rx="4" ry="1.7" style="fill:#aaa; fill-opacity:1.0;"/>' +
            '</g>' +
            '</defs>' +
            '<g transform="translate(11,11)">' +
            '<g>' +
            '<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="1.5s" repeatDur="indefinite"/>' +
            '<use xlink:href="#pair"/>' +
            '<use xlink:href="#pair" transform="rotate(45)"/>' +
            '<use xlink:href="#pair" transform="rotate(90)"/>' +
            '<use xlink:href="#pair" transform="rotate(135)"/>' +
            '</g>' +
            '</g>' +
            '</svg>';

        this.svgLoading = SVG.addChildImage(main, {
            "xlink:href": "data:image/svg+xml," + encodeURIComponent(loadingImg),
            "x": 10,
            "y": 0,
            "width": 22,
            "height": 22,
            "visibility": "hidden"
        });

        this.div = div;
        this.svgdiv = svgdiv;
        this.titlediv = titlediv;
        this.resizeDiv = resizediv;
        this.configBtn = configBtn;

        this.main = main;
        this.hoverRect = hoverRect;

        this.rendered = true;
        this.status = "ready";
    },
    _drawHistogramLegend: function () {
        var histogramHeight = this.histogramRenderer.histogramHeight;
        var multiplier = this.histogramRenderer.multiplier;

        this.histogramGroup = SVG.addChild(this.svgGroup, 'g', {
            'class': 'histogramGroup',
            'visibility': 'hidden'
        });
        var text = SVG.addChild(this.histogramGroup, "text", {
            "x": 21,
            "y": histogramHeight + 4,
            "font-size": 12,
            "opacity": "0.9",
            "fill": "orangered",
            'class': this.fontClass
        });
        text.textContent = "0-";
        var text = SVG.addChild(this.histogramGroup, "text", {
            "x": 14,
            "y": histogramHeight + 4 - (Math.log(10) * multiplier),
            "font-size": 12,
            "opacity": "0.9",
            "fill": "orangered",
            'class': this.fontClass
        });
        text.textContent = "10-";
        var text = SVG.addChild(this.histogramGroup, "text", {
            "x": 7,
            "y": histogramHeight + 4 - (Math.log(100) * multiplier),
            "font-size": 12,
            "opacity": "0.9",
            "fill": "orangered",
            'class': this.fontClass
        });
        text.textContent = "100-";
        var text = SVG.addChild(this.histogramGroup, "text", {
            "x": 0,
            "y": histogramHeight + 4 - (Math.log(1000) * multiplier),
            "font-size": 12,
            "opacity": "0.9",
            "fill": "orangered",
            'class': this.fontClass
        });
        text.textContent = "1000-";
    },
    draw: function () {

    },
    getFeaturesToRenderByChunk: function (response, filters) {
        //Returns an array avoiding already drawn features in this.chunksDisplayed

        var getChunkId = function (position) {
            return Math.floor(position / response.chunkSize);
        };
        var getChunkKey = function (chromosome, chunkId) {
            return chromosome + ":" + chunkId;
        };

        var chunks = response.items;
        var features = [];


        var feature, displayed, featureFirstChunk, featureLastChunk, features = [];
        for (var i = 0, leni = chunks.length; i < leni; i++) {
            if (this.chunksDisplayed[chunks[i].chunkKey] != true) {//check if any chunk is already displayed and skip it

                for (var j = 0, lenj = chunks[i].value.length; j < lenj; j++) {
                    feature = chunks[i].value[j];

                    //check if any feature has been already displayed by another chunk
                    displayed = false;
                    featureFirstChunk = getChunkId(feature.start);
                    featureLastChunk = getChunkId(feature.end);
                    for (var chunkId = featureFirstChunk; chunkId <= featureLastChunk; chunkId++) {
                        var chunkKey = getChunkKey(feature.chromosome, chunkId);
                        if (this.chunksDisplayed[chunkKey] == true) {
                            displayed = true;
                            break;
                        }
                    }
                    if (!displayed) {
                        features.push(feature);
                    }
                }
                this.chunksDisplayed[chunks[i].chunkKey] = true;
            }
        }
        return features;
    }
};
