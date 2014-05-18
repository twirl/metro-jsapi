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