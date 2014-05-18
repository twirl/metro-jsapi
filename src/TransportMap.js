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