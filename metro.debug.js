ymaps.modules.define('TransportMap', [
    'util.extend',
    'transportMap.Scheme',
    'transportMap.SchemeView',
    'transportMap.SchemeLayer',
    'transportMap.StationCollection',
    'transportMap.AnnotationCollection',
    'event.Manager',
    'projection.Cartesian',
    'Map'
], function (provide, extend,
    Scheme, SchemeView, SchemeLayer,
    StationCollection, AnnotationCollection,
    EventManager, CartesianProjection, Map) {
    /**
     * TransportMap.
     * Instance of this class is exposed to the user
     * through the 'createTransportMap' factory.
     * TransportMap creates a map and inserts SchemeLayer into it.
     *
     * Has an EventManager, which is a parent for all Events on the map & stations
     *
     * Exposes "StationCollection" via "stations" property
     *
     * Note: constructor returns a promise, not an instanceof TransportMap
     *
     * @constructor
     *
     * @param {String} city (e.g. 'minsk', 'moscow')
     * @param {String|Element} container
     * @param {Object} [state]
     * @param {Array<Number>} [state.center] geo point
     * @param {Boolean} [state.shaded] Boolean flag to shade or not a map
     * @param {Array<Number>} [state.selection] List of selected station codes
     * @param {Object} [options]
     * @param {Number} [options.maxZoom = 3]
     * @param {Number} [options.minZoom = 0]
     * @param {Number} [options.lang = 'ru']
     * @param {String} [options.path = 'node_modules/metro-data/'] A path to the metro-data
     * @example
     * ymaps.modules.load(['TransportMap']).then(function (TransportMap) {
     *     TransportMap.create('moscow', 'map_container_id').then(function (map) {
     *         // Do something valuable
     *     });
     * });
     */
    function TransportMap(city, container, state, options) {
        this._schemeId = this._schemeIdByCity[city];

        this._options = extend({
            path: 'node_modules/metro-data/',
            minZoom: 0,
            maxZoom: 3
        }, options);
        this._state = extend({
            shaded: false,
            center: [0, 0],
            selection: []
        }, state);

        if (typeof container === 'string') {
            this._container = document.getElementById(container);
        } else {
            this._container = container;
        }
        if (!this._state.hasOwnProperty('zoom')) {
            this._state.zoom = SchemeLayer.getFitZoom(this._container);
        }

        //NOTE promise is returned from constructor
        return this._loadScheme().then(this._onSchemeLoad.bind(this));
    }

    TransportMap.create = function (city, container, state, options) {
        return new TransportMap(city, container, state, options);
    }

    extend(TransportMap.prototype, {
        _loadScheme: function () {
            return Scheme.create([
                this._options.path,
                this._schemeId, '.', this._options.lang, '.svg'
            ].join(''));
        },
        /**
         * Loads an svg scheme
         * and returns promise that provides an SVGElement
         *
         * @returns {ymaps.vow.Promise}
         */
        _onSchemeLoad: function (scheme) {
            this._scheme = scheme;
            this._schemeView = new SchemeView(scheme);

            this._map = this._createMap();
            this._map.layers.add(new SchemeLayer(this._schemeView));

            this.stations = new StationCollection(this._schemeView);
            this._map.geoObjects.add(this.stations);
            this.stations.select(this._state.selection);

            this.annotations = new AnnotationCollection(this);

            // Event manager added
            this.events = new EventManager();
            // Enable event bubbling
            this._map.events.setParent(this.events);

            if (this._state.shaded) {
                this.shade();
            }

            return this;
        },
        _createMap: function () {
            var map = new Map(
                    this._container,
                    {
                        controls: [],
                        center: this._state.center,
                        zoom: this._state.zoom,
                        type: null
                    },
                    {
                        minZoom: this._options.minZoom,
                        maxZoom: this._options.maxZoom,
                        autoFitToViewport: 'always',
                        avoidFractionalZoom: false,
                        projection: new CartesianProjection([
                            [-1, -1],
                            [1, 1]
                        ])
                    }
                );

            return map;
        },
        /**
         * Fades in the map without an animation
         */
        shade: function () {
            this._schemeView.fadeIn();
            this.events.fire('shadechange', {type: 'shade', target: this});
        },
        /**
         * Fades out the map without an animation
         */
        unshade: function () {
            this._schemeView.fadeOut();
            this.events.fire('shadechange', {type: 'unshade', target: this});
        },
        /**
         * Returns coordinates of a center in abstract scheme coordinates
         *
         * @returns {Array<Number>}
         */
        getCenter: function () {
            return this._map.getCenter();
        },
        /**
         * Sets coordinates of center.
         * Changing of a center position is async
         *
         * @see http://api.yandex.ru/maps/doc/jsapi/beta/ref/reference/Map.xml#setCenter
         *
         * @param {Array<Number>} center
         * @param {Number} [zoom]
         * @param {Object} [options]
         *
         * @returns {Vow.Promise}
         */
        setCenter: function () {
            return this._map.setCenter.apply(this._map, arguments);
        },
        /**
         * Get a current map zoom
         *
         * @returns {Number}
         */
        getZoom: function () {
            return this._map.getZoom();
        },
        /**
         * Sets new zoom
         *
         * @see http://api.yandex.ru/maps/doc/jsapi/beta/ref/reference/Map.xml#setZoom
         *
         * @param {Number} zoom
         * @param {Object} [options]
         *
         * @returns {Vow.Promise}
         */
        setZoom: function () {
            return this._map.setZoom.apply(this._map, arguments);
        },
        /**
         * @returns {Number}
         */
        getSchemeId: function () {
            return this._schemeId;
        },
        _schemeIdByCity: {
            moscow: 1,
            spb: 2,
            kiev: 8,
            kharkov: 9,
            minsk: 13
        },
        /**
         * Get current map instance.
         * Can be used for adding controls
         *
         * @returns ymaps.Map
         */
        getMap: function () {
            return this._map;
        },
        destroy: function () {
            this._map.destroy();
        }
    });

    provide(TransportMap);
});
ymaps.modules.define('transportMap.Annotation', [
    'util.extend',
    'util.augment',
    'geometry.Point',
    'Placemark',
    'layout.storage',
    'templateLayoutFactory'
], function (provide, extend, augment, PointGeometry, Placemark, layoutStorage, layoutFactory) {
    function Annotation (position, properties, options) {
        Annotation.superclass.constructor.call(
            this,
            position,
            properties,
            extend({
                iconLayout: 'transportMap#annotation'
            }, options)
        );
    }

    augment(Annotation, Placemark);

    layoutStorage.add('transportMap#annotation', layoutFactory.createClass(
        '<ymaps style="position: absolute; left: {{ options.offset.0|default:"20" }}px; top: {{ options.offset.1|default:"-20" }}px"' +
            '<ymaps class="ymaps-tm-annotation-content">{{ properties.iconContent }}</ymaps>' +
        '</ymaps>', {
        }
    ));

    provide(Annotation);
});
ymaps.modules.define('transportMap.AnnotationCollection', [
    'util.augment',
    'Collection'
], function (provide, augment, Collection) {
    function AnnotationCollection (map) {
        AnnotationCollection.superclass.constructor.call(this);
        this._map = map;
    }
    augment(AnnotationCollection, Collection, {
        getMap: function () {
            return this._map;
        }
    });

    provide(AnnotationCollection);
});
ymaps.modules.define('transportMap.Scheme', [
    'vow',
    'util.extend'
], function (provide, vow, extend) {
    var Scheme = function (url) {
            this._text = '';
            this._node = null;
            this._metaData = null;
            return this._load(url);
        };

    Scheme.create = function (url) {
        return new Scheme(url);
    };

    extend(Scheme.prototype, {
        _load: function (url) {
            var xhr = new XMLHttpRequest(),
                deferred = new vow.Deferred();

            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    try {
                        var text = this._text = xhr.responseText;
                        this._node = (new DOMParser()).parseFromString(text, "text/xml").firstChild;
                        var metaDataNode = this._node.getElementsByTagName('metadata')[0];
                        this._metaData = JSON.parse(metaDataNode.firstChild.data);
                        deferred.resolve(this);
                    } catch (e) {
                        deferred.reject(e);
                    }
                }
            }.bind(this);
            xhr.onerror = function (e) {
                deferred.reject(e);
            };
            xhr.open('GET', url, true);
            xhr.send(null);

            return deferred.promise();
        },

        createDom: function () {
            return this._node.cloneNode(true);
        },

        getSize: function () {
            return [this._metaData.width, this._metaData.height];
        },

        getStations: function () {
            return this._metaData.stations;
        },

        getLabel: function (code) {
            return this._metaData.labels[code];
        }
    });

    provide(Scheme);
});
ymaps.modules.define('transportMap.SchemeLayer', [
    'util.augment',
    'collection.Item'
], function (provide, augment, Item) {
    /**
     * Creates a layer with a scheme,
     * that should be added to the map.
     * Proxies events from a map to the SchemeView
     *
     * @constructor
     * @inherits ymaps.collection.Item
     *
     * @param {SchemeView} schemeView
     */
    function SchemeLayer(schemeView) {
        SchemeLayer.superclass.constructor.call(this);

        this._schemeView = schemeView;
    }
    augment(SchemeLayer, Item, {
        /**
         * Init function. Sets everything when a layer is added to the map
         *
         * @override ymaps.collection.Item
         */
        onAddToMap: function (map) {
            SchemeLayer.superclass.onAddToMap.call(this, map);

            this._pane = map.panes.get('ground');
            this._updateSchemePosition();

            this._pane.events.add(
                ['viewportchange', 'zoomchange', 'clientpixelschange'],
                this._updateSchemePosition,
                this
            );

            this._pane.getElement().appendChild(this._schemeView.getNode());
        },

        _updateSchemePosition: function () {
            this._schemeView.updatePosition(
                this._pane.toClientPixels([0, 0]),
                Math.pow(2, this._pane.getZoom())
            );
        },

        getSchemeView: function () {
            return this._schemeView;
        }
    });
    /**
     * Calculates zoom to fit the layer into the container
     *
     * @param {HTMLElement} containerNode
     *
     * @returns {Number}
     */
    SchemeLayer.getFitZoom = function (containerNode) {
        return this.getZoomFromScale(Math.min(
            containerNode.clientWidth / this.SQUARE_SIZE,
            containerNode.clientHeight / this.SQUARE_SIZE
        ));
    };
    /**
     * Size of the layer with zoom = 0
     *
     * @see http://api.yandex.ru/maps/doc/jsapi/beta/ref/reference/projection.Cartesian.xml
     */
    SchemeLayer.SQUARE_SIZE = 256;
    /**
     * Translates an image scale into a map zoom
     *
     * @param {Number} zoom
     *
     * @returns {Number}
     */
    SchemeLayer.getScaleFromZoom = function (zoom) {
        return Math.pow(2, zoom);
    };
    /**
     * Translates a map zoom into an image scale
     *
     * @param {Number} zoom
     *
     * @returns {Number}
     */
    SchemeLayer.getZoomFromScale = function (scale) {
        return Math.log(scale) * Math.LOG2E;
    };

    provide(SchemeLayer);
});
ymaps.modules.define('transportMap.SchemeView', [
    'util.extend'
], function (provide, extend) {
    /**
     * View on a scheme image.
     * Responsible for moving and scaling.
     * Contains a meta data from a scheme
     *
     * @constructor
     *
     * @param {SVGElement} scheme Root node of a scheme image
     */
    function SchemeView (scheme) {
        this._scheme = scheme;
        this._selfSize = scheme.getSize();
        this._zeroZoomScale = Math.min(
            256 / this._selfSize[0],
            256 / this._selfSize[1]
        );

        this._offset = [
            Math.floor((256 - this._selfSize[0] * this._zeroZoomScale) / 2),
            Math.floor((256 - this._selfSize[1] * this._zeroZoomScale) / 2),
        ];

        this._node = document.createElement('ymaps');
        extend(this._node.style, {
            position: 'absolute',
            width: this._selfSize[0] + 'px',
            height: this._selfSize[1] + 'px',
        })

        this._schemeNode = scheme.createDom();
        this._schemeNode.setAttribute('width', '100%');
        this._schemeNode.setAttribute('height', '100%');
        this._schemeNode.setAttribute('viewBox', '0 0 ' + this._selfSize[0] + ' ' + this._selfSize[1]);

        this._node.appendChild(this._schemeNode);
    }

    extend(SchemeView.prototype, {
        fadeOut: function () {
            this._schemeNode.getElementById('scheme-layer').style.opacity = '';
        },
        fadeIn: function () {
            this._schemeNode.getElementById('scheme-layer').style.opacity = 0.5;
        },
        /**
         * Move an image.
         * Relative to the initial position
         *
         * @param {Array} vector An array of dx and dy values
         */
        updatePosition: function (clientCenter, mapScale) {
            var scale = this._zeroZoomScale * mapScale,
                offset = [
                    this._offset[0] + clientCenter[0],
                    this._offset[1] + clientCenter[1]
                ];

            var value = 'translate(' + offset[0] + 'px,' + offset[1] + 'px)';;

            ['-webkit-', '-moz-', '-ms-', '-o-', ''].forEach(function (prefix) {
                this._node.style[prefix + 'transform-origin'] = '0px 0px';
                this._node.style[prefix + 'transform'] = value;
            }, this);

            extend(this._node.style, {
                width: this._selfSize[0] * scale + 'px',
                height: this._selfSize[1] * scale + 'px'
            });
        },
        /**
         * @returns {SVGElement}
         */
        getNode: function () {
            return this._node;
        },

        getScheme: function () {
            return this._scheme;
        },

        getSchemeNode: function () {
            return this._schemeNode;
        },

        toClientPixels: function (globalPixels, zoom) {
            var mapScale = Math.pow(2, zoom),
                zeroZoomPixels = [
                    globalPixels[0] / mapScale,
                    globalPixels[1] / mapScale
                ];

            return [
                zeroZoomPixels[0] / this._zeroZoomScale - this._offset[0],
                zeroZoomPixels[1] / this._zeroZoomScale - this._offset[1]
            ];
        },

        fromClientPixels: function (clientPixels, zoom) {
            var zeroZoomPixels = [
                    (clientPixels[0] + this._offset[0]) * this._zeroZoomScale,
                    (clientPixels[1] + this._offset[1]) * this._zeroZoomScale
                ],
                mapScale = Math.pow(2, zoom);

            return [
                zeroZoomPixels[0] * mapScale,
                zeroZoomPixels[1] * mapScale
            ];
        }
    });

    provide(SchemeView);
})
ymaps.modules.define('transportMap.Station', [
    'util.augment',
    'vow',
    'collection.Item',
    'Rectangle'
], function (provide, augment, vow, Item, Rectangle) {
    /**
     * Station instance
     * Is exposed via StationCollection#each
     *
     * Has an Event Manager, that fires a custom event "selectionchange"
     * For more events please see
     * @see http://api.yandex.ru/maps/doc/jsapi/beta/ref/reference/GeoObject.xml#events-summary
     *
     * @constructor
     * @inherits ymaps.collection.Item
     *
     * @param {Object} metadata Metadata for the station
     * @param {SchemeView} SchemeView
     * @param {ymap.Map} ymap
     */
    function Station(metadata, schemeView, options) {
        Station.superclass.constructor.call(this, options);
        this._schemeView = schemeView;

        this.code = metadata.labelId;
        this.title = metadata.name;
        this.selected = false;
        this._annotations = [];

        this.events.add('click', function () {
            //toggle select
            this[this.selected ? 'deselect':'select']();
        }, this);
    }
    augment(Station, Item, {
        /**
         * @override ymaps.collection.Item
         */
        onAddToMap: function () {
            Station.superclass.onAddToMap.apply(this, arguments);

            this._getGeoObjects().forEach(function (geoObject) {
                // event bubbling
                geoObject.events.setParent(this.events);
            }, this);
        },
        /**
         * Non-cacheble getter for label node.
         * Too many labels on the map to cache them all
         *
         * @returns {HTMLElement}
         */
        getLabelNode: function () {
            return this._schemeView.getSchemeNode().getElementById('label-' + this.code);
        },

        getNode: function () {
            return this._schemeView.getSchemeNode().getElementById('station-' + this.code);
        },
        /**
         * Selects current station.
         * Fires 'selectionchange' event
         * If station is already selected - nothing happens
         */
        select: function () {
            var rectNode;
            if (!this.selected) {
                rectNode = this.getLabelNode().getElementsByTagName('rect')[0];

                this.selected = true;
                rectNode.style.stroke = '#bbb';
                rectNode.style.opacity = 1;

                // make nodes non-shadable
                this._appendTo('highlight-layer-stations', this._getStationNodes());
                this._appendTo('highlight-layer-labels', this.getLabelNode());

                this.events.fire('selectionchange', {type: 'select', target: this});
            }
        },
        /**
         * Deselects current station.
         * Fires 'selectionchange' event
         * If station is not selected - nothing happens
         */
        deselect: function () {
            var rectNode;
            if (this.selected) {
                rectNode = this.getLabelNode().getElementsByTagName('rect')[0];

                this.selected = false;
                rectNode.style.stroke = '';
                rectNode.style.opacity = '';

                this._appendTo('scheme-layer-stations', this._getStationNodes());
                this._appendTo('scheme-layer-labels', this.getLabelNode());

                this.events.fire('selectionchange', {type: 'deselect', target: this});
            }
        },
        _appendTo: function (id, elements) {
            var parentNode = this._schemeView.getSchemeNode().getElementById(id);

            [].concat(elements).forEach(function (element) {
                parentNode.appendChild(element);
            });
        },
        _getGeoObjects: function () {
            var svgNodes = [this.getLabelNode()].concat(this._getStationNodes());

            return svgNodes.map(this._createGeoObject, this);
        },
        _getStationNodes: function () {
            var labelMeta = this._schemeView.getScheme().getLabel(this.code);

            return labelMeta.stationIds.map(function (id) {
                return this._schemeView.getSchemeNode().getElementById('station-' + id);
            }, this);
        },
        _createGeoObject: function (svgNode) {
            var rectangle = new Rectangle(
                this._getGeoBBox(svgNode),
                {},
                {fill: true, opacity: 0}
            );
            this.getMap().geoObjects.add(rectangle);
            return rectangle;
        },

        _getGeoBBox: function (svgNode) {
            var schemeView = this._schemeView,
                projection = this.getMap().options.get('projection'),
                zoom = this.getMap().getZoom(),
                bbox = svgNode.getBBox();

            return [
                projection.fromGlobalPixels(
                    schemeView.fromClientPixels([bbox.x, bbox.y], zoom),
                    zoom
                ),
                projection.fromGlobalPixels(
                    schemeView.fromClientPixels([bbox.x + bbox.width, bbox.y + bbox.height], zoom),
                    zoom)
            ];
        },

        getPosition: function () {
            var bbox = this._getGeoBBox(this.getNode());
            return [
                (bbox[0][0] + bbox[1][0]) /2,
                (bbox[0][1] + bbox[1][1]) /2
            ];
        },

        annotate: function (properties, options, dontAddToMap) {
            var deferred = new vow.Deferred();

            ymaps.modules.require('transportMap.Annotation').spread(function (Annotation) {
                var annotation = new Annotation (this.getPosition(), properties, options);
                this._annotations.push(annotation);
                if (!dontAddToMap) {
                    this.getMap().geoObjects.add(annotation);
                }
                deferred.resolve(annotation);
            }.bind(this), deferred.reject.bind(deferred));

            return deferred.promise();
        }
    });

    provide(Station);
});
ymaps.modules.define('transportMap.StationCollection', [
    'util.augment',
    'vow',
    'Collection',
    'transportMap.Station'
], function (provide, augment, vow, Collection, Station) {
    /**
     * Station manager.
     * Responsible for selection/deselection of stations
     *
     * Has an EventManager, which is a parent for all Stations' EventManagers
     *
     * @constructor
     * @inherits ymaps.Collection
     *
     * @param {SchemeView} schemeView
     * @param {ymap.Map} ymap
     */
    function StationCollection(schemeView) {
        StationCollection.superclass.constructor.call(this);

        var code,
            metadata = schemeView.getScheme().getStations(),
            station;

        this._stationsMap = {};

        for (code in metadata) {
            station = new Station(metadata[code], schemeView);
            // event bubbling
            this._stationsMap[code] = station;
            this.add(station);
            station.events.setParent(this.events);
        }
    }
    augment(StationCollection, Collection, {
        /**
         * Selects stations by codes
         *
         * @param {Array<Number>|Number} codes
         */
        select: function (codes) {
            [].concat(codes).forEach(function (code) {
                this.getByCode(code).select();
            }, this);
        },
        /**
         * Deselects stations
         *
         * @param {Array<Number>|Number} codes
         */
        deselect: function (codes) {
            [].concat(codes).forEach(function (code) {
                this.getByCode(code).deselect();
            }, this);
        },
        /**
         * Returns codes of all selected stations
         *
         * @returns {Array<Number>}
         */
        getSelection: function () {
            var codes = [];
            this.each(function (station) {
                if (station.selected) {
                    codes.push(station.code);
                }
            });
            return codes;
        },
        getByCode: function (code) {
            return this._stationsMap[code];
        },
        /**
         * Search stations by words starting with the letters %request%
         *
         * @param {String} request
         *
         * @returns {ymaps.vow.Promise} Resolves to an array of stations
         */
        search: function (request) {
            return new vow.fulfill(this.filter(function (station) {
                return station.title.split(' ').some(function (token) {
                    return token.substr(0, request.length) === request;
                });
            }));
        }
    });

    provide(StationCollection);
});