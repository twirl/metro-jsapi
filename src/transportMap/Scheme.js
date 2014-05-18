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