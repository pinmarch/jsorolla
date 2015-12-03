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

BamTrack.prototype = new Track();

function BamTrack(args) {
    Track.call(this, args);
};

_.extend(BamTrack.prototype, {
    initialize: function (args) {
        this.dataType = 'features';
    },

    render: function (targetId) {
        var _this = this;

        this.initializeDom(targetId);

        this.svgCanvasOffset = (this.width * 3 / 2) / this.pixelBase;
        this.svgCanvasLeftLimit = this.region.start - this.svgCanvasOffset*2;
        this.svgCanvasRightLimit = this.region.start + this.svgCanvasOffset*2

        this.dataAdapter.on('data:ready',function(event) {
            var features;
            if (event.dataType == 'histogram') {
                _this.renderer = _this.histogramRenderer;
                features = event.items;
            } else {
                _this.renderer = _this.defaultRenderer;
                console.log("data:ready", event);
                features = _this.getFeaturesToRenderByChunk(event);
            }
            _this.renderer.render(features, {
                svgCanvasFeatures : _this.svgCanvasFeatures,
                featureTypes: _this.featureTypes,
                renderedArea: _this.renderedArea,
                pixelBase : _this.pixelBase,
                position : _this.region.center(),
                region : _this.region,
                width : _this.width,
                regionSize: _this.region.length(),
                maxLabelRegionSize: _this.maxLabelRegionSize,
                pixelPosition : _this.pixelPosition
            });

            _this.updateHeight();
            _this.setLoading(false);
        });
    },

    draw: function () {
        var _this = this;

        this.svgCanvasOffset = (this.width * 3 / 2) / this.pixelBase;
        this.svgCanvasLeftLimit = this.region.start - this.svgCanvasOffset * 2;
        this.svgCanvasRightLimit = this.region.end + this.svgCanvasOffset * 2

        this.updateHistogramParams();
        this.cleanSvg();

        this.dataType = 'features';
        if (this.histogram) {
            this.dataType = 'histogram';
        }

        console.log(this.zoom, this.visibleRange, this.visibleRegionSize, this.region.length());
        if (typeof this.visibleRegionSize === 'undefined' ||
            this.region.length() < this.visibleRegionSize) {

            this.setLoading(true);
            this.dataAdapter.getData({
                dataType: this.dataType,
                region: new Region({
                    chromosome: this.region.chromosome,
                    start: this.svgCanvasLeftLimit,
                    end: this.svgCanvasRightLimit
                }),
                params: {
                    histogram: this.histogram,
                    histogramLogarithm: this.histogramLogarithm,
                    histogramMax: this.histogramMax,
                    interval: this.interval
                }
            });

            this.invalidZoomText.setAttribute("visibility", "hidden");
        }else{
            this.invalidZoomText.setAttribute("visibility", "visible");
        }
        this.updateHeight();
    },


    move: function (disp) {
        var _this = this;

        this.dataType = 'features';
        if (this.histogram) {
            this.dataType = 'histogram';
        }

        _this.region.center();
        var pixelDisplacement = disp*_this.pixelBase;
        this.pixelPosition -= pixelDisplacement;

        //parseFloat important
        var move =  parseFloat(this.svgCanvasFeatures.getAttribute("x")) + pixelDisplacement;
        this.svgCanvasFeatures.setAttribute("x",move);

        var virtualStart = parseInt(this.region.start - this.svgCanvasOffset);
        var virtualEnd = parseInt(this.region.end + this.svgCanvasOffset);

        if (typeof this.visibleRegionSize === 'undefined' ||
            this.region.length() < this.visibleRegionSize) {

            if(disp > 0 && virtualStart < this.svgCanvasLeftLimit) {
                var newLeft = parseInt(this.svgCanvasLeftLimit - this.svgCanvasOffset);
                this.dataAdapter.getData({
                    dataType: this.dataType,
                    region: new Region({
                        chromosome: _this.region.chromosome,
                        start: newLeft,
                        end: this.svgCanvasLeftLimit
                    }),
                    params: {
                        histogram: this.histogram,
                        histogramLogarithm: this.histogramLogarithm,
                        histogramMax: this.histogramMax,
                        interval: this.interval
                    }
                });
                this.svgCanvasLeftLimit = newLeft;
            }

            if(disp < 0 && virtualEnd > this.svgCanvasRightLimit) {
                var newRight = parseInt(this.svgCanvasRightLimit + this.svgCanvasOffset);
                this.dataAdapter.getData({
                    dataType: this.dataType,
                    region: new Region({
                        chromosome: _this.region.chromosome,
                        start: this.svgCanvasRightLimit,
                        end: newRight
                    }),
                    params: {
                        histogram: this.histogram,
                        histogramLogarithm: this.histogramLogarithm,
                        histogramMax: this.histogramMax,
                        interval: this.interval
                    }
                });
                this.svgCanvasRightLimit = newRight;
            }
        }
    },

    getFeaturesToRenderByChunk: function (response) {
        var newitems = [],
            newresponse = {};
        _.extend(newresponse, response);

        // Returns an array avoiding already drawn features in this.chunksDisplayed
        var chunks = response.items,
            dataType = response.dataType;

        for ( var i = 0, leni = chunks.length; i < leni; i++) {
            if(this.chunksDisplayed[chunks[i].key] != true){
            // check if any chunk is already displayed and skip it

                var features = [];
                for (var j = 0, lenj = chunks[i].reads.length; j < lenj; j++) {
                    var feature = chunks[i].reads[j],
                        chrChunkCache = this.dataAdapter.cache[dataType],
                        featureFirstChunk = chrChunkCache.getChunkId(feature.start),
                        featureLastChunk = chrChunkCache.getChunkId(feature.end),
                        displayed = false;

                    //check if any feature has been already displayed by another chunk
                    for (var chunkId = featureFirstChunk; chunkId <= featureLastChunk; chunkId++) {
                        var chunkKey = chrChunkCache.getChunkKey(feature.chromosome, chunkId);
                        if(this.chunksDisplayed[chunkKey] == true){
                            displayed = true;
                            break;
                        }
                    }
                    if (!displayed) {
                        features.push(feature);
                    }
                }
                this.chunksDisplayed[chunks[i].key] = true;

                var newchunk = {};
                _.extend(newchunk, chunks[i]);
                newchunk.reads = features;
                newitems.push(newchunk);
            }
        }

        _.extend(newresponse, { items: newitems });
        return newresponse;
    }
});
