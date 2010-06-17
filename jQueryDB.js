(function(window, undefined) {

DataStore = window.DataStore = function(name) {
	this.name = name;
	return this;
}
	
DataStore.fn = DataStore.prototype = {

	length: 0,
	name: "",
	data: [],
	bindings: [],

	create: function(obj) {
		return new RecordSet(this, obj);
	}, 
	
	get: function(selector) {
		return new RecordSet(this, Selector.find(this.data, selector));
	},
	
	createTable: function(name) {
		this.data[name] = [];
		
		return this;
	},
	
	append: function(table, obj) {
		if(!this.data[table]) this.data[table] = [];
		
		obj = obj.database == this ? Array.prototype.slice.call(obj) : [obj];
		Array.prototype.push.apply(this.data[table], obj);
		
		//trigger events		
		var bindings = this.bindings;
		for(var i = 0, len = bindings.length; i < len; i++) {
			var binding = bindings[i];
			var index = [], data = [];
			
			this.get(binding.selector).each(function(i) {
				if(this === obj[0]) {
					index.push(i);
					data.push(this);
				}
			});
			binding.action({
				type: "append",
				index: index,
				data: new RecordSet(this.database, data)
			});
		}
		return this;
	},
	
	prepend: function(table, obj) {
		if(!this.data[table]) this.data[table] = [];
		
		obj = obj.database == this ? Array.prototype.slice.call(obj) : [obj];
		Array.prototype.unshift.apply(this.data[table], obj);
		
		//trigger events		
		var bindings = this.bindings;
		for(var i = 0, len = bindings.length; i < len; i++) {
			var binding = bindings[i];
			var index = [], data = [];
			
			this.get(binding.selector).each(function(i) {
				if(this === obj[0]) {
					index.push(i);
					data.push(this);
				}
			});
			binding.action({
				type: "prepend",
				index: index,
				data: new RecordSet(this.database, data)
			});
		}
		return this;
	},
	
	insert: function(table, index, obj) {
		if(!this.data[table]) this.data[table] = [];
		
		//generate arguments array to be passed to apply
		obj = [index, 0].concat(obj.database == this ? Array.prototype.slice.call(obj) : [obj]);
		Array.prototype.splice.apply(this.data[table], obj);
		
		//trigger events		
		var bindings = this.bindings;
		for(var i = 0, len = bindings.length; i < len; i++) {
			var binding = bindings[i];
			var index = [], data = [];
			
			this.get(binding.selector).each(function(i) {
				if(this === obj[2]) {
					index.push(i);
					data.push(this);
				}
			});
			
			binding.action({
				type: "insert",
				index: index,
				data: new RecordSet(this.database, data)
			});
		}
		
		return this;
	},
	
	bind: function(selector, fn) {
		this.bindings.push({
			selector: selector,
			action: fn
		});
		
		return this;
	}
	
};

var RecordSet = function(database, obj) {
	this.database = database;

	this.length = 0;
	Array.prototype.push.apply(this, isArray(obj) ? obj : [obj]);
}

RecordSet.prototype = {
	length: 0,
	database: null,
	 
	each: function(callback) {
	 	for(var i = 0, len = this.length; i < len; i++) {
	 		callback.call(this[i], i);
	 	}
	 	
	 	return this;
	},
	
	update: function() {
		//allow update(prop, value) or update({ prop: value, prop: value...})
		var set = {};
		if(arguments.length === 2) 
			set[arguments[0]] = arguments[1];
		else if(arguments.length === 1) 
			set = arguments[0];
			
		//mark the items for updating
		this.each(function() {
			this.__update__ = true;
		});
			
		//trigger events		
		var bindings = this.database.bindings;
		for(var i = 0, len = bindings.length; i < len; i++) {
			var binding = bindings[i];
			var index = [], data = [];
			
			this.database.get(binding.selector).each(function(i) {
				if(this.__update__) {
					index.push(i);
					
					for(var i in set) {
						this[i] = set[i];
					}
					delete this.__update__;
					data.push(this);
				}
			});
			binding.action({
				type: "update",
				index: index,
				data: new RecordSet(this.database, data)
			});
		}
		
		//remove markings from other rows
		for(var table in this.database.data) {
			var rows = this.database.data[table];
			for(var i = 0; i < rows.length; i++) {
				if(rows[i].__update__) {
					delete rows[i].__update__;
				}
			}
		}
		
		return this;
	},
	
	remove: function() {
		//mark items for removal
		var self = this;
		this.each(function(i) {
			this.__remove__ = true;
			delete self[i];
		});
		
		//trigger events		
		var bindings = this.database.bindings;
		for(var i = 0, len = bindings.length; i < len; i++) {
			var binding = bindings[i];
			var index = [];
			
			this.database.get(binding.selector).each(function(i) {
				if(this.__remove__) {
					index.push(i);
				}
			});
			binding.action({
				type: "remove",
				index: index,
			});
		}
		
		//remove elements from database
		for(var table in this.database.data) {
			var rows = this.database.data[table];
			
			var i = rows.length, index = [];
			while(i--) {
				var row = rows[i];
				if(row.__remove__) {
					Array.remove(rows, i);
				}
			}
		}
		
		this.length = 0;
		return this;
	},
	
	map: function(prop) {
		var fn = isFunction(prop) ? prop : function(i) {
			return this[prop];
		}
		
		var ret = [];
		this.each(function(i) {
			ret[ret.length] = fn.call(this, i);
		});
		
		return ret;
	},
	
	filter: function(selector) {
		var filtered;
		if(isFunction(selector)) {
			filtered = [];
			this.each(function(i) {
				if(selector.call(this, i))
					filtered[filtered.length] = this;
			});
		}
		else {
			var data = Array.prototype.slice.call(this);
			filtered = Selector.find(data, selector);
		}
		return new RecordSet(this.database, filtered);
	},
	
	eq: function(index) {
		return new RecordSet(this.database, this[index]);
	}
};

forEach({
	appendTo: "append",
	prependTo: "prepend",
	insertInto: "insert"
}, function(name, map) {
	RecordSet.prototype[name] = function(table) {
		var args = Array.prototype.slice.call(arguments);
		args.push(this);
		this.database[map].apply(this.database, args);
		return this;
	};
});

function forEach(obj, fn) {
	for(var key in obj) {
		fn.call(obj, key, obj[key]);
	}
}

function isArray(obj) {
	return Object.prototype.toString.call(obj) === "[object Array]";
}
function isFunction(obj) {
	return Object.prototype.toString.call(obj) === "[object Function]";
}

// Array Remove - By John Resig (MIT Licensed)
Array.remove = function(array, from, to) {
  var rest = array.slice((to || from) + 1 || array.length);
  array.length = from < 0 ? array.length + from : from;
  return array.push.apply(array, rest);
};


var Selector = {
	match: {
		table: /^((?:[\w\u00c0-\uFFFF\*_-]|\\.)+)/,
		attr: /\[\s*((?:[\w\u00c0-\uFFFF_-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,
		filter: /:((?:[\w\u00c0-\uFFFF_-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/
	},
	
	filters: {
		first: function(i) {
			return i === 0;
		},
		last: function(i) {
			return i === context.length - 1;
		},
		even: function(i){
			return i % 2 === 0;
		},
		odd: function(i) {
			return i % 2 === 1;
		},
		lt: function(i){
			return i < curtoken.parts[3] - 0;
		},
		gt: function(i){
			return i > curtoken.parts[3] - 0;
		},
		eq: function(i){
			return curtoken.parts[3] - 0 == i;
		}
	},
	
	attr: {
		"=" : function(key, val) {
			return key == val;
		},
		
		"!=" : function(key, val) {
			return key != val;
		},
		
		"*=": function(key, val) {
			return key.indexOf(val) !== -1;
		},
		
		"^=": function(key, val) {
			return key.indexOf(val) === 0;
		},
		
		"$=": function(key, val) {
			return key.substr(key.length - val.length) === val;
		}
	},
	
	find: function(context, selector) {
		/* TOKENIZE THE SELECTOR */
		var tokens = [], m, type;
		while(selector !== "") {
			for(var type in this.match) {
				if(m = this.match[type].exec(selector)) {
					tokens.push({ 
						type: type,
						parts: m
					});
					selector = selector.replace(this.match[type], "");
					continue;
				}
			}
		}
		
		/* FILTER THE CONTEXT */
		var curtoken;
		for(var i = 0, len = tokens.length; i < len; i++) {
			curtoken = tokens[i];
			if(curtoken.type === "table") {
				//make sure that the tablename is not a number
				if(typeof +curtoken.parts[0] !== NaN && context[curtoken.parts[0]]) {
					context = context[curtoken.parts[0]];
				}
				else {
					context = [];
					continue;
				}
			}
			else if(curtoken.type === "attr") {
				var c = [];
				for(var i = 0, len = context.length; i < len; i++) {
					var el = context[i];
					var type = curtoken.parts[2];
					if(type) {
						if(this.attr[type](el[curtoken.parts[1]], curtoken.parts[4])) {
							c[c.length] = el;
						}
					}
					else { //hasAttribute
						if(el[curtoken.parts[1]] != undefined) {
							c[c.length] = el;
						}
					}
				}
				context = c;
			}
			else if(curtoken.type === "filter") {
				var c = [];
				for(var i = 0, len = context.length; i < len; i++) {
					var el = context[i];
					if(this.filters[curtoken.parts[1]] && this.filters[curtoken.parts[1]](i)) {
						c[c.length] = el;
					}
				}
				context = c;
			}
		}
		return context;
	}
}

})(this);