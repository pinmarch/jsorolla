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

//Parent class for all renderers
function Renderer(args) {

    // Using Underscore 'extend' function to extend and add Backbone Events
    _.extend(this, Backbone.Events);

    this.fontClass = 'ocb-font-ubuntumono ocb-font-size-16';
    this.toolTipfontClass = 'ocb-font-default';

    if (_.isFunction(this.prototype.initialize)) {
        this.prototype.initialize.apply(this, args);
    }

    _.extend(this, args);

    this.on(this.handlers);
};

Renderer.prototype = {

    initialize: function (args) {
    },

    render: function (items) {
    },

    getFeatureX: function (feature, metrics) {
        //returns svg feature x value from feature genomic position
        var middle = metrics.width / 2;
        var x = metrics.pixelPosition + middle - ((metrics.position - feature.start) * metrics.pixelBase);
        return x;
    },

    getDefaultConfig: function (type) {
        return FEATURE_TYPES[type];
    },

    getLabelWidth: function (label, args) {
        /* insert in dom to get the label width and then remove it*/
        var svgLabel = SVG.create("text", {
            'font-weight': 400,
            'class': this.fontClass
        });
        svgLabel.textContent = label;
        $(args.svgCanvasFeatures).append(svgLabel);
        var svgLabelWidth = $(svgLabel).width();
        $(svgLabel).remove();
        return svgLabelWidth;
    }
};
