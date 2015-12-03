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

function BamAdapter(args){

    _.extend(this, Backbone.Events);

    _.extend(this, args || {});
    this.featureCache = new BamCache(args.featureCache || {});

    if (this.featureConfig != null) {
        if (this.featureConfig.filters != null) {
            this.filtersConfig = this.featureConfig.filters;
        }
        if (this.featureConfig.options != null) { //apply only check boxes
            this.optionsConfig = this.featureConfig.options;
            for (var i = 0; i < this.optionsConfig.length; i++) {
                if (this.optionsConfig[i].checked == true) {
                    this.options[this.optionsConfig[i].name] = true;
                    this.params[this.optionsConfig[i].name] = true;
                }
            }
        }
    }
}

BamAdapter.prototype = {
    host : null,
    gzip : true,
    params : {},

    clearData: function() {
        this.featureCache.clear();
    },

    setFilters: function(filters) {
        this.clearData();
        this.filters = filters;
        for(filter in filters){
            var value = filters[filter].toString();
            delete this.params[filter];
            if(value != ""){
                this.params[filter] = value;
            }
        }
    },

    setOption: function(opt, value) {
        if(opt.fetch){
            this.clearData();
        }
        this.options[opt.name] = value;
        for(option in this.options){
            if(this.options[opt.name] != null){
                this.params[opt.name] = this.options[opt.name];
            }else{
                delete this.params[opt.name];
            }
        }
    },

    getData: function(args) {
        var _this = this;

        _.extend(this.params, args);
        this.params.resource = this.resource.oid;
        this.params.species = Utils.getSpeciesCode(this.species.text);


        var region = args.region;
        if (region.start > 300000000 || region.end < 1) {
            return;
        }
        region.start = (region.start < 1) ? 1 : region.start;
        region.end = (region.end > 300000000) ? 300000000 : region.end;

        var dataType = "data";
        if(args.histogram){
            dataType = "histogram" + args.interval;
        }
        this.params.dataType = dataType;


        //Create one FeatureChunkCache by datatype
        if (_.isUndefined(this.cache)) { this.cache = {}; }
        if (_.isUndefined(this.cache[dataType])) {
            this.cache[dataType] = new FeatureChunkCache();
        }

        var cachedItems = this.featureCache.getFeatureChunksByRegion(region),
            chunksByRegion = this.cache[dataType].getCachedByRegion(region);


        var regionSuccess = function (data) {
            var timeId = _this.resource.oid + " save " + Utils.randomString(4);
            console.time(timeId);
            /** time log **/

            var chunks = [];
            for (var i = 0; i < data.response.length; i++) {
                var queryResult = data.response[i];
                if (!_.isUndefined(queryResult.result)) {
                    var region = new Region(queryResult.id),
                        features = queryResult.result;
                    _this.featureCache.putFeaturesByRegion(features, region, _this.resource, dataType);

                    var chunk = _this.featureCache.getFeatureChunksByRegion(region);
                    Array.prototype.push.apply(chunks, chunk);
                }
            }

            chunks = chunks.concat(cachedItems);

            chunks.forEach(function(item) {
                console.log("put chunk", item.key);
                _this.cache[dataType].putChunk(item.key, true);
            });

            /** time log **/
            console.timeEnd(timeId);

            if (chunks.length > 0) {
                _this.trigger('data:ready', {
                    items: chunks, dataType: dataType,
                    chunkSize: _this.featureCache.chunkSize, sender: _this
                });
            }

            // var dataType = "data";
            // if(data.params.histogram){
            //     dataType = "histogram" + data.params.interval;
            //     _this.featureCache.putHistogramFeaturesByRegion(data.result, query, data.resource, dataType);
            // }else{
            //     _this.featureCache.putFeaturesByRegion(data.result, query, data.resource, dataType);
            // }

            // var items = _this.featureCache.getFeatureChunksByRegion(query, dataType);
        };


        if (chunksByRegion.notCached.length > 0) {
            //chunks needed to retrieve
            var querys = _.map(chunksByRegion.notCached, function (rgn) {
                return new Region(rgn).toString();
            });

            //limit queries
            var n = 50;
            var lists = _.groupBy(querys, function (a, b) {
                return Math.floor(b / n);
            });
            var queriesList = _.toArray(lists); //Added this to convert the returned object to an array.

            for ( var i = 0, li = queriesList.length; i < li; i++) {
                //accountId, sessionId, bucketname, objectname, region,
                var cookie = $.cookie("bioinfo_sid");
                cookie = ( cookie != '' && cookie != null ) ?  cookie : 'dummycookie';
                OpencgaManager.region({
                    accountId: this.resource.account,
                    sessionId: cookie,
                    bucketId: this.resource.bucketId,
                    objectId: this.resource.oid,
                    region: queriesList[i],
                    queryParams: {},
                    success: regionSuccess
                });
            }
        } else if (cachedItems.length > 0) {
            _this.trigger('data:ready',{
                items: cachedItems, dataType: dataType,
                params: this.params, cached: true,
                chunkSize: _this.featureCache.chunkSize, sender: this
            });
        }
    }
};
