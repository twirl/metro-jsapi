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