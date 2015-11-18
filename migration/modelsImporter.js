'use strict';
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
var Q = require('q');
var _ = require('lodash');

/**
 *
 * @param Model - mongoose model instance
 * @param {[]} modelContent
 * @private
 */
function _upsertModelDataCollection(Model, modelContent) {
    return Q.all(_.map(modelContent, _upsertModelData.bind(null, Model)));
}

function _upsertModelData(Model, content) {
    return Q.Promise(function (resolve, reject) {
        if (!content) {
            //if we have no content then we just stop operation
            return resolve(false);
        }
        //todo:  maybe need wrap with ObjectId?
        var id = content._id;
        content._id = new ObjectId(content._id);
        //todo: overwrite can be true
        Model.update({_id: id}, content, {upsert: true, multi: false, overwrite: true}, function (err) {
            if (err) {
                return reject(err);
            }

            resolve(true);
        });
    });
}

var _cleanCollection = function (Model) {
    return Q.Promise(function (resolve, reject) {
        Model.remove({}, function (err) {
            if (err) {
                return reject(err);
            }


            resolve(true);
        });
    });
};

var _importModelData = function (options, modelInfo) {
    var modelName = modelInfo.modelName;
    var modelContent = modelInfo.content;
    //todo: maybe user wants remove all documents for this model so we need run general import logic

    return Q
        .try(function () {
            return mongoose.model(modelName);
        })
        .then(function (Model) {
            //this is not empty array
            //if overwrite so we need clean all collections and insert new data
            var importChain = Q.resolve();
            if (options && options.overrideAll) {
                importChain = _cleanCollection(Model);
            }

            //else we need only update existent documents
            return importChain.then(function () {
                return _upsertModelDataCollection(Model, modelContent);
            });

        })
        .catch(function (err) {
            console.error(err);
            throw err;
        });

};


function importModels(modelInfoArray, options) {
    if (modelInfoArray) {
        var upsertModelsPromises = _.map(modelInfoArray, _importModelData.bind(null, options));

        return Q.all(upsertModelsPromises);
    }

    Q.resolve([]);
}


module.exports.importModels = importModels;