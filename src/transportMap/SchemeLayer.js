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