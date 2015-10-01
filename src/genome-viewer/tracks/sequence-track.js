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

SequenceTrack.prototype = new Track({});

function SequenceTrack(args) {

    // Using Underscore 'extend' function to extend and add Backbone Events
    _.extend(this, Backbone.Events);

    //set default args
    args.resizable = false;
    Track.call(this, args);

    _.extend(this, args);
};


SequenceTrack.prototype.getMetricsInfo = function() {

    this.svgCanvasOffset = Math.floor((this.width * 3 / 2) / this.pixelBase);
    this.svgCanvasLeftLimit = this.region.start - this.svgCanvasOffset;
    this.svgCanvasRightLimit = this.region.end + this.svgCanvasOffset;

    console.log('getMetricsInfo() called',
        this.svgCanvasLeftLimit, this.svgCanvasRightLimit,
        (this.svgCanvasRightLimit - this.svgCanvasLeftLimit), 'nt');

    return {
        svgCanvasFeatures: this.svgCanvasFeatures,
        pixelBase: this.pixelBase,
        region: this.region,
        position: this.region.center(),
        svgCanvasLeftLimit: this.svgCanvasLeftLimit,
        svgCanvasRightLimit: this.svgCanvasRightLimit,
        width: this.width,
        pixelPosition: this.pixelPosition
    };
};

SequenceTrack.prototype.render = function (targetId) {
    var _this = this;

    this.initializeDom(targetId);

    this.dataAdapter.on('data:ready', function (event) {
        _this.renderer.render(event, _this.getMetricsInfo());
        _this.setLoading(false);
    });
};

SequenceTrack.prototype.draw = function () {
    var _this = this;

    this.getMetricsInfo();

    this.cleanSvg();

    if (typeof this.visibleRegionSize === 'undefined' ||
        this.region.length() < this.visibleRegionSize) {

        this.setLoading(true);
        var data = this.dataAdapter.getData({
            region: new Region({
                chromosome: this.region.chromosome,
                start: this.svgCanvasLeftLimit,
                end: this.svgCanvasRightLimit
            })
        });
        this.invalidZoomText.setAttribute("visibility", "hidden");
    } else {
        this.invalidZoomText.setAttribute("visibility", "visible");
    }
};


SequenceTrack.prototype.move = function (disp) {
    var _this = this;

    var pixelDisplacement = disp * _this.pixelBase;
    this.pixelPosition -= pixelDisplacement;

    //parseFloat important
    var move = parseFloat(this.svgCanvasFeatures.getAttribute("x")) + pixelDisplacement;
    this.svgCanvasFeatures.setAttribute("x", move);

    var virtualStart = parseInt(this.region.start - this.svgCanvasOffset);
    var virtualEnd = parseInt(this.region.end + this.svgCanvasOffset);

    // check if track is visible in this region size
    if (typeof this.visibleRegionSize === 'undefined' ||
        this.region.length() < this.visibleRegionSize) {

        if (disp > 0 && virtualStart < this.svgCanvasLeftLimit) {
            var newLeft = parseInt(this.svgCanvasLeftLimit - this.svgCanvasOffset);
            this.dataAdapter.getData({
                region: new Region({
                    chromosome: _this.region.chromosome,
                    start: newLeft,
                    end: this.svgCanvasLeftLimit
                }),
                sender: 'move'
            });
            this.svgCanvasLeftLimit = newLeft;
        }

        if (disp < 0 && virtualEnd > this.svgCanvasRightLimit) {
            var newRight = parseInt(this.svgCanvasRightLimit + this.svgCanvasOffset);
            this.dataAdapter.getData({
                region: new Region({
                    chromosome: _this.region.chromosome,
                    start: this.svgCanvasRightLimit,
                    end: newRight,
                }),
                sender: 'move'
            });
            this.svgCanvasRightLimit = newRight;
        }
    }
};
