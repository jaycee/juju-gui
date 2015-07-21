/*
This file is part of the Juju GUI, which lets users view and manage Juju
environments within a graphical interface (https://launchpad.net/juju-gui).
Copyright (C) 2012-2013 Canonical Ltd.

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License version 3, as published by
the Free Software Foundation.

This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranties of MERCHANTABILITY,
SATISFACTORY QUALITY, or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero
General Public License for more details.

You should have received a copy of the GNU Affero General Public License along
with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

'use strict';

describe('juju utils', function() {
  describe('getAssetsPrefix', function() {
    var testUtils, utils, Y, oldConfig;

    before(function(done) {
      var modules = ['juju-utils'];
      Y = YUI(GlobalConfig).use(modules, function(Y) {
        utils = Y.namespace('juju.utils');
        done();
      });
    });

    beforeEach(function() {
      oldConfig = window.juju_config;
      window.juju_config = {};
    });

    afterEach(function() {
      window.juju_config = oldConfig;
    });

    it('defaults to /juju-ui/assets', function() {
      assert.equal(utils.getAssetsPrefix(), '/juju-ui/assets');
    });

    it('can be updated via juju_config', function() {
      window.juju_config.urlPrefix = '/foo'
      assert.equal(utils.getAssetsPrefix(), '/foo/juju-ui/assets');
    });
  });
});
