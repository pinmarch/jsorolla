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

SequenceRenderer.prototype = new Renderer();

function SequenceRenderer(args){

    // Using Underscore 'extend' function to extend and add Backbone Events
    _.extend(this, Backbone.Events);

    this.fontClass = 'ocb-font-ubuntumono ocb-font-size-16';
    this.toolTipfontClass = 'ocb-font-default';

    this.renderedPosition = {};

    _.extend(this, args);
    Renderer.call(this, args);
};


SequenceRenderer.prototype.render = function(features, metrics) {
    var halfWidth = metrics.width / 2,
        start = metrics.svgCanvasLeftLimit,
        seqStart = features.items.start,
        seqString = features.items.sequence,
        seqLength = seqString.length;

    if (seqLength > metrics.svgCanvasRightLimit - metrics.svgCanvasLeftLimit) {
        seqLength = metrics.svgCanvasRightLimit - metrics.svgCanvasLeftLimit + 1;
    }

    console.log('rendering ' + seqLength + 'nt(in ' + seqString.length + ') sequence', metrics);
    console.time("Sequence render " + seqLength);

    var xConv = function (pos) {
        return halfWidth + metrics.pixelPosition - metrics.pixelBase / 2 -
               ((metrics.initialCenter - pos) * metrics.pixelBase);
    };

    console.log("position ", start, start + seqLength, ":: from ", xConv(start) ,"to ", xConv(start + seqLength));
    for (var i = 0; i < seqLength; i++) {
        if (this.renderedPosition[start] == null) {
            var x = xConv(start),
                seqChar = seqString.charAt(metrics.svgCanvasLeftLimit - seqStart + i);

            var text = SVG.addChild(metrics.svgCanvasFeatures, "text", {
                'x': x + 1,
                'y': 12,
                'fill': SEQUENCE_COLORS[seqChar],
                'class': this.fontClass
            });
            text.textContent = seqChar;
            $(text).qtip({
                content: seqChar + " " +
                         (start).toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,"),
                position: {target: 'mouse', adjust: {x: 15, y: 0}, viewport: $(window), effect: false},
                style: {width: true, classes: this.toolTipfontClass + ' qtip-light qtip-shadow'}
            });
            if ($(text).length > 0) this.renderedPosition[start] = !0;
        }
        start++;
    }

    console.timeEnd("Sequence render " + seqLength);
};
