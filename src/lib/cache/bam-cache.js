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
    this.gzip = true;
    this.maxSize = 10*1024*1024;
    this.size = 0;

    if (args != null){
        if(args.chunkSize != null){
            this.chunkSize = args.chunkSize;
        }
        if(args.gzip != null){
            this.gzip = args.gzip;
        }
    }

    this.cache = {};

    //deprecated trackSvg has this object now
    //this.chunksDisplayed = {};

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
        var firstRegionChunk, lastRegionChunk, chunks = [], key;
        firstRegionChunk = this._getChunk(region.start);
        lastRegionChunk = this._getChunk(region.end);
        for (var i = firstRegionChunk; i <= lastRegionChunk; i++) {
            key = region.chromosome + ":" + i;
            // check if this key exists in cache (features from files)
            if(this.cache[key] != null) {
                chunks.push(this.cache[key]);
            }
        }
        return chunks;
    },

    putFeaturesByRegion: function(resultObj, region, featureType, dataType) {
        var key, firstChunk, lastChunk, firstRegionChunk, lastRegionChunk, read, gzipRead;
        var reads = resultObj.reads;
        var coverage = resultObj.coverage;

        //initialize region
        firstRegionChunk = this._getChunk(region.start);
        lastRegionChunk = this._getChunk(region.end);

        var chunkIndex = 0;
        console.time("BamCache.prototype.putFeaturesByRegion1")
        //TODO the region for now is a chunk region, so this for is always 1 loop
        for(var i=firstRegionChunk, c=0; i<=lastRegionChunk; i++, c++){
            key = region.chromosome+":"+i;
            if(this.cache[key]==null || this.cache[key][dataType] == null){
                this.cache[key] = {};
                this.cache[key][dataType] = [];
                this.cache[key].key = key;
                this.cache[key].start = parseInt(region.start)+(c*this.chunkSize);
                this.cache[key].end = parseInt(region.start)+((c+1)*this.chunkSize)-1;
            }
            if(dataType === 'data'){
                //divide the coverage array in multiple arrays of chunksize length
                // var chunkCoverage = coverage.slice(chunkIndex,chunkIndex+this.chunkSize);
                var chunkCoverageAll = coverage.all.slice(chunkIndex,chunkIndex+this.chunkSize);
                var chunkCoverageA = coverage.a.slice(chunkIndex,chunkIndex+this.chunkSize);
                var chunkCoverageC = coverage.c.slice(chunkIndex,chunkIndex+this.chunkSize);
                var chunkCoverageG = coverage.g.slice(chunkIndex,chunkIndex+this.chunkSize);
                var chunkCoverageT = coverage.t.slice(chunkIndex,chunkIndex+this.chunkSize);
                var chunkCoverage = {
                    "all":chunkCoverageAll,
                    "a":chunkCoverageA,
                    "c":chunkCoverageC,
                    "g":chunkCoverageG,
                    "t":chunkCoverageT
                };
            }

            if(this.gzip) {
                this.cache[key]["coverage"]=RawDeflate.deflate(JSON.stringify(chunkCoverage));
            }else{
                this.cache[key]["coverage"]=chunkCoverage;
            }
            chunkIndex+=this.chunkSize;
        }
        console.timeEnd("BamCache.prototype.putFeaturesByRegion1");
        console.time("BamCache.prototype.putFeaturesByRegion");
        var ssss = 0;


        if(dataType === 'data'){
            for(var index = 0, len = reads.length; index<len; index++) {
                read = reads[index];
                read.featureType = 'bam';
                firstChunk = this._getChunk(read.start);
                lastChunk = this._getChunk(read.end == 0?read.end=-1:read.end);//0 is not a position, i set to -1 to avoid enter in for
                // Some reads has end = 0. So will not be drawn IGV does not draw those reads

                if(this.gzip) {
                    gzipRead = RawDeflate.deflate(JSON.stringify(read));
                    //ssss+= gzipRead.length;
                }else{
                    gzipRead = read;
                    //ssss+= JSON.stringify(gzipRead).length;
                }

                for(var i = firstChunk, c = 0; i <= lastChunk; i++, c++) {
                    if(i >= firstRegionChunk && i <= lastRegionChunk) {//only if is inside the called region
                        key = read.chromosome + ":" + i;
                        // if(this.cache[key].start==null){
                        //     this.cache[key].start = parseInt(region.start)+(c*this.chunkSize);
                        // }
                        // if(this.cache[key].end==null){
                        //     this.cache[key].end = parseInt(region.start)+((c+1)*this.chunkSize)-1;
                        // }
                        // if(this.cache[key][dataType] != null){
                        //     this.cache[key][dataType] = [];
                            this.cache[key][dataType].push(gzipRead);
                        // }

                    }
                }
            }
        }

        console.timeEnd("BamCache.prototype.putFeaturesByRegion");
        console.log("BamCache.prototype.putFeaturesByRegion"+ssss);
    },

    clear: function() {
        this.size = 0;
        this.cache = {};
        console.log("bamCache cleared");
    }
};
