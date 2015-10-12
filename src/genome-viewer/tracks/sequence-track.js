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

SequenceTrack.prototype = new Track();

function SequenceTrack(args) {
    Track.call(this, args);
};

_.extend(SequenceTrack.prototype, {
initialize: function (args) {
    //set default args
    this.resizable = false;
},

getMetricsInfo: function () {

    this.svgCanvasOffset = Math.floor(this.width * 1.5 / this.pixelBase);
    this.svgCanvasLeftLimit = this.region.start - this.svgCanvasOffset;
    this.svgCanvasRightLimit = this.region.end + this.svgCanvasOffset;

    console.log('getMetricsInfo() called',
        this.svgCanvasLeftLimit, this.svgCanvasRightLimit,
        (this.svgCanvasRightLimit - this.svgCanvasLeftLimit), 'nt initialCenter:',
        this.initialCenter);

    return {
        svgCanvasFeatures: this.svgCanvasFeatures,
        pixelBase: this.pixelBase,
        region: this.region,
        position: this.region.center(),
        initialCenter: this.initialCenter,
        svgCanvasLeftLimit: this.svgCanvasLeftLimit,
        svgCanvasRightLimit: this.svgCanvasRightLimit,
        width: this.width,
        pixelPosition: this.pixelPosition
    };
},

render: function (targetId) {
    var _this = this;

    this.initializeDom(targetId);

    this.dataAdapter.on('data:ready', function (event) {
        _this.renderer.render(event, _this.getMetricsInfo());
        _this.setLoading(false);
    });
},

resetSvg: function () {
    this.getMetricsInfo();

    this.cleanSvg();
    this.svgCanvasFrame.removeAttribute("transform");
    this.initialCenter = this.region.center();
    this.renderer.renderedPosition = {};
},

draw: function () {
    var _this = this;

    this.resetSvg();

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
},


move: function (disp) {
    var _this = this;

    this.svgCanvasFrame.setAttribute("transform",
        'translate(' + (this.initialCenter - this.region.center()) * this.pixelBase + ',0)');

    var virtualStart = parseInt(this.region.start - this.svgCanvasOffset);
    var virtualEnd = parseInt(this.region.end + this.svgCanvasOffset);

    // check if track is visible in this region size
    if (typeof this.visibleRegionSize === 'undefined' ||
        this.region.length() < this.visibleRegionSize) {

        if (disp > 0 && virtualStart < this.svgCanvasLeftLimit) {
            var newLeft = parseInt(this.svgCanvasLeftLimit - this.svgCanvasOffset * 2);
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
            var newRight = parseInt(this.svgCanvasRightLimit + this.svgCanvasOffset * 2);
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
}
});
