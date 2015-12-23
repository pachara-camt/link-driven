(function(angular){
	'use strict';

	angular.module('ldrvn', [])
		.provider('ldrvn', [
			function(){
				var local = {
					'engines': {},
					'services': [],
					'configLoaders': {},
				};

				var provider = {
					'appendEngine': function(engines){
						angular.extend(local.engines, engines);

						return provider;
					},
					'$get': [
						'$window', '$cacheFactory', '$http', '$interpolate', '$q', '$log', '$injector',
						function($window, $cacheFactory, $http, $interpolate, $q, $log, $injector){
							var urlSolver = (function(){
								var aTag = angular.element('<a></a>');

								return function(url){
									aTag.attr('href', url);
									return aTag.prop('href');
								};
							})();
							function LinkDriven(links){
								Object.defineProperty(this, '$$links', {
									'value': links,
								});
								angular.forEach(links, function(link){
									LinkDriven.init(link);
								});
							}

							angular.extend(LinkDriven, {
								'init': function(link){
									if(angular.isDefined(link.$pattern)) return link;

									if(angular.isDefined(link.href)) link.href = $window.decodeURI(urlSolver(link.href));
									if(angular.isDefined(link.pattern)) link.pattern = $window.decodeURI(urlSolver(link.pattern));
									link.$pattern = $interpolate((angular.isDefined(link.pattern))? link.pattern : link.href);
									return link;
								},
							});

							angular.extend(LinkDriven.prototype, {
								'link': function(href){
									for(var i = 0; i < this.$$links.length; i++){
										var link = this.$$links[i];
										if((link.href === href) || (link.alias === href)) return LinkDriven.init(link);
									}

									return null;
								},
								'forLinks': function(rel){
									var links = [];
									for(var i = 0; i < this.$$links.length; i++){
										var link = this.$$links[i];
										if(link.rel === rel) links.push(LinkDriven.init(link));
									}

									return links;
								},
								'prepareURI': function(uri){
									if(angular.isString(uri)){
										uri = [uri, {}];
									} else if(uri.$pattern){
										uri = [uri, {}];
									} else{
										uri = uri.slice(0);
									}

									if(angular.isUndefined(uri[0].$pattern)) uri[0] = this.link(uri[0]);

									return uri;
								},
								'url': function(uri){
									uri = this.prepareURI(uri);
									return (uri[0] === null)? null : uri[0].$pattern(uri[1]);
								},
								'http': function(uri, config){
									var uri = this.prepareURI(uri);

									var extend = {'url': this.url(uri)};
									if(angular.isDefined(uri[0].method)) extend['method'] = uri[0].method;

									return $http(angular.extend({}, config, extend)).then(function(response){
										return response.data;
									});
								},
								'load': function(uri, config){
									if(arguments.length < 2) config = {};

									return this.http(uri, config);
								},
								'send': function(uri, data, config){
									if(arguments.length < 3) config = {};

									config = angular.extend({}, {'data': data, 'method': 'post'});
									return this.http(uri, config);
								},
							});

							function Config(config){
								if(angular.isUndefined(config.links)) config.links = [];
								LinkDriven.call(this, config.links);
								Object.defineProperty(this, '$$config', {
									'value': config,
								});
							}

							angular.extend(Config, {
								'cache': $cacheFactory('config-cache'),
							});

							Config.prototype = Object.create(LinkDriven.prototype);
							Config.prototype.constructor = Config;
							angular.extend(Config.prototype, {
								'prop': function(name){
									return this.$$config[name];
								},
							});

							var util = {
								'ldrvn': function(links){
									return new LinkDriven(links);
								},
								'loadConfig': function(url){
									if(angular.isObject(url)){
										if(angular.isFunction(url.catch)){
											return url;
										} else{
											return $q(function(resolve){
												if(url instanceof Config){
													return resolve(url);
												} else{
													return resolve(new Config(url));
												}
											});
										}
									}

									return local.configLoaders[url] = $http.get(url, {'cache': Config.cache}).then(function(response){
										return new Config(response.data);
									});
								},
								'createService': function(config, description){
									var preparedDescription = Object.create(local.services);
									var service = Object.create(angular.extend(preparedDescription, description));

									Object.defineProperty(service, 'promise', {
										'value': util.loadConfig(config).then(function(configService){
											Object.defineProperty(service, '$$configService', {
												'value': configService,
											});

											return service;
										}),
									});

									return service;
								},
							};

							var factory = {
								'extendService': function(services){
									angular.extend(local.services, services);

									return factory;
								},
								'util': util,
							};

							angular.forEach(local.engines, function(engine, name){
								LinkDriven.prototype[name] = $injector.invoke(engine, factory);
							});

							return factory;
						}
					],
				};

				return provider;
			}
		])
	;
})(this.angular);
