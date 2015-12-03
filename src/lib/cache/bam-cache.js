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

function BamCache(args) {
    this.args = args;
    this.id = Math.round(Math.random() * 10000000); // internal id for this class

    this.chunkSize = 50000;
    this.gzip = false;
    this.maxSize = 10*1024*1024;
    this.size = 0;

    if (args != null){
        _.extend(this, args);
    }

    this.cache = {};
    this.maxFeaturesInterval = 0;//for local histogram
};

BamCache.prototype = {
    putHistogramFeaturesByRegion: FeatureCache.prototype.putFeaturesByRegion,

    _getChunk: function(position) {
        return Math.floor(position/this.chunkSize);
    },

    getFeatureChunk: function(key) {
        if(this.cache[key] != null) {
            return this.cache[key];
        }
        return null;
    },

    getFeatureChunksByRegion: function(region) {
        var chunks = [],
            firstRegionChunk = this._getChunk(region.start),
            lastRegionChunk = this._getChunk(region.end);

        for (var i = firstRegionChunk; i <= lastRegionChunk; i++) {
            var key = region.chromosome + ":" + i;
            if(this.cache[key] != null) {
                chunks.push(this.cache[key]);
            }
        }
        return chunks;
    },

    putFeaturesByRegion: function(resultObj, region, featureType, dataType) {
        var reads = resultObj.reads,
            coverage = resultObj.coverage;

        //initialize region
        var firstRegionChunk = this._getChunk(region.start),
            lastRegionChunk = this._getChunk(region.end),
            chunkIndex = 0;

        if (reads[0] && reads[0].chromosome == region.chromosome) {
            for (var i = firstRegionChunk, c = 0; i <= lastRegionChunk; i++, c++) {
                var key = region.chromosome + ":" + i;
                if(this.cache[key] == null || this.cache[key][dataType] == null){
                    this.cache[key] = {};
                    this.cache[key].key = key;
                    this.cache[key].start = parseInt(region.start)+(c * this.chunkSize);
                    this.cache[key].end = parseInt(region.start)+((c + 1) * this.chunkSize) - 1;
                }

                this.cache[key].reads =
                    reads.filter(function(read) {
                        var firstChunk = this._getChunk(read.start),
                            lastChunk = this._getChunk(read.end == 0 ? read.end = -1 : read.end);
                        // 0 is not a position, i set to -1 to avoid enter in for
                        // Some reads has end = 0. So will not be drawn IGV does not draw those reads
                        return (firstChunk <= i && lastChunk >= i);
                    }, this).map(function(read) {
                        read.featureType = 'bam';
                        return read;
                    });
                console.log("bam cached", key, this.cache[key]);

                var chunkCoverage = {};
                if(dataType === 'data'){
                    // divide the coverage array in multiple arrays of chunksize length
                    var chunkCoverageAll = coverage.all.slice(chunkIndex, chunkIndex + this.chunkSize),
                        chunkCoverageA = coverage.a.slice(chunkIndex, chunkIndex + this.chunkSize),
                        chunkCoverageC = coverage.c.slice(chunkIndex, chunkIndex + this.chunkSize),
                        chunkCoverageG = coverage.g.slice(chunkIndex, chunkIndex + this.chunkSize),
                        chunkCoverageT = coverage.t.slice(chunkIndex, chunkIndex + this.chunkSize);
                    chunkCoverage = {
                        "all":chunkCoverageAll,
                        "a":chunkCoverageA, "c":chunkCoverageC,
                        "g":chunkCoverageG, "t":chunkCoverageT
                    };
                }
                this.cache[key].coverage = chunkCoverage;

                chunkIndex += this.chunkSize;
            }
        }
    },

    clear: function() {
        this.size = 0;
        this.cache = {};
        console.log("bamCache cleared");
    }
};
