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

function AttributesDataAdapter(args){
    var _this = this;
    _.extend(this, Backbone.Events);

    this.dataSource;
    this.async = true;
    this.jsonObject;

    //set instantiation args, must be last
    _.extend(this, args);

	this.json = {};
	this.attributes = [];
	this.data = [];

    this.on(this.handlers);

    if (this.async) {
        this.dataSource.on('success', function (data) {
            _this.parse(data);
            _this.trigger('data:load', {});
        });
        this.dataSource.fetch(this.async);
    } else {
        var data = this.dataSource.fetch(this.async);
        _this.parse(data);
    }

	
};

AttributesDataAdapter.prototype.parse = function(data){
	var _this = this;
	
	var lines = data.split("\n");
	if(lines.length > 2) {
		var types = lines[0].substring(1).replace(/^\s+|\s+$/g,"").split("\t");
		var defVal = lines[1].substring(1).replace(/^\s+|\s+$/g,"").split("\t");
		var headers = lines[2].substring(1).replace(/^\s+|\s+$/g,"").split("\t");
		
		for(var i=0; i < headers.length; i++){
			this.attributes.push({
					"name": headers[i],
					"type": types[i],
					"defaultValue": defVal[i]
			});
		}
	}
	
	for (var i = 3; i < lines.length; i++) {
		var line = lines[i].replace(/^\s+|\s+$/g,"");
		if ((line != null)&&(line.length > 0)){
			var fields = line.split("\t");
			if (fields[0].substr(0,1) != "#") {
				this.data.push(fields);
			}
		}
	}
};

AttributesDataAdapter.prototype.getAttributesJSON = function(){
	var json = {};
	json.attributes = this.attributes;
	json.data = this.data;
	return json;
};