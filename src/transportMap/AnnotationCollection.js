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