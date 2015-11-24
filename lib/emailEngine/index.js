
'use strict';

var mongoose = require('mongoose');
var Q = require('q');

/**
 *
 * @param templateName  the name of the template you wish to send
 * @param contentParameters, the parmeters that will be replaced/injected in the content
 * @param mailDestination, an object where the mail need to be send to
 * @returns Promise
 *
 *@example
 var contentParameters = {
        firstName: 'Peter',
        lastName: 'van de Put',
        address:'800 Market Street',
        city:'Chattanooga'
    };

 var mailDestination = {
        to: ['you@domain.com'],
        cc: ['another@domain.com','someone@domain.com],
        bcc:['info@cia.org']
    };

 */
exports.renderAndSendTemplate = function (templateName, contentParameters,mailDestination) {
    var $this = this;
    var deferred = Q.defer();
    var KNSetting = mongoose.model('KNSetting');
    KNSetting.getKNSetting('SYSTEM', 'templateEngine', 'emailtemplate')
        .then(function (knSetting) {
            //load package
            var dolphin = require('dolphinio');
            var templateEngine = dolphin.load(knSetting);
            templateEngine.renderTemplate(templateName,contentParameters)
                .then(function(renderedTemplate){
                    $this.sendMail(mailDestination,renderedTemplate.fromEmail,renderedTemplate.subject,renderedTemplate.html)
                        .then(function(response){
                            deferred.resolve(response);
                        })
                        .catch(function(err){
                            deferred.reject(err);
                        });
                })
                .catch(function(err){
                    deferred.reject(err);
                });
        })
    return deferred.promise;
};

/**
 *
 * @param mailDestination, an object where the mail need to be send to
 * @param from, the fromAddress
 * @param subject
 * @param html to send
 * @returns Promise
 *
 *@example

 var mailDestination = {
        to: ['you@domain.com'],
        cc: ['another@domain.com','someone@domain.com],
        bcc:['info@cia.org']
    };

 *
 */
exports.sendMail = function(mailDestination,from,subject,html){
    var deferred = Q.defer();
    getMailer(from).then(function (mailer) {
        var mailData = {
            to:mailDestination.to,
            cc:mailDestination.cc,
            bcc:mailDestination.bcc,
            from:from,
            subject:subject,
            html:html
        };
        mailer.sendMail(mailData, function (err, responseStatus) {
            if (err) {
                return deferred.reject(new Error('Email has not been sent'));
            }
            deferred.resolve();
        });
    });
    return deferred.promise;
}

function getMailer(from) {
    var deferred = Q.defer();
    var nodemailer = require('nodemailer');
    var smtpTransport = require('nodemailer-smtp-transport');
    var KNSetting = mongoose.model('KNSetting');
    KNSetting.getKNSettingsByGroup('SMTP')
        .then(function (options) {
            var mailOption = {
                host: options.server,
                port: options.port,
                emailFrom:from ? from : options.from
            };
            if (options.useAuthentication === 'true') {
                mailOption.auth = {
                    user: options.username,
                    pass: options.password
                };
            }
            deferred.resolve(nodemailer.createTransport(smtpTransport(mailOption)));
        });
    return deferred.promise;
}

