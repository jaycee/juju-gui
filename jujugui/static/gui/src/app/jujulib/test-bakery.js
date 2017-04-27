/**
This file is part of the Juju GUI, which lets users view and manage Juju
environments within a graphical interface (https://launchpad.net/juju-gui).
Copyright (C) 2017 Canonical Ltd.

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

describe('Bakery', () => {
  let bakery, fakeLocalStorage, macaroonlib, storage, client;

  beforeAll((done) => {
    macaroonlib = require('js-macaroon');
    done();
  });

  beforeEach(() => {
    fakeLocalStorage = {
      store: {},
      getItem: function(item) {
        return this.store[item];
      },
      setItem: function(item, value) {
        this.store[item] = value;
      },
      removeItem: function(item) {
        delete this.store[item];
      }
    };

    client = {
      _sendRequest: sinon.stub(),
      sendGetRequest: function(...args) {
        this._sendRequest('get', ...args);
      },
      sendPostRequest: function(...args) {
        this._sendRequest('post', ...args);
      },
      sendPutRequest: function(...args) {
        this._sendRequest('put', ...args);
      },
      sendDeleteRequest: function(...args) {
        this._sendRequest('delete', ...args);
      },
      sendPatchRequest: function(...args) {
        this._sendRequest('patch', ...args);
      },
    };

    storage = new jujulib.BakeryStorage(
      fakeLocalStorage, {services: {charmstore: 'http://example.com/'}});
    bakery = new jujulib.Bakery(client, storage);
  });

  afterEach(() => {
    bakery = null;
  });

  it('exists', () => {
    assert.isObject(bakery);
  });

  describe('can send requests', () => {
    it('sets the method', () => {
      const url = 'http://example.com/';
      const headers = {header: 42};
      const callback = response => 42;
      let body = 'content';
      let args;
      ['PATCH', 'post', 'PUT'].forEach(method => {
        bakery.sendRequest(url, method, headers, body, callback);
        assert.equal(client._sendRequest.callCount, 1);
        args = client._sendRequest.args[0];
        assert.equal(args[0], method.toLowerCase());
        assert.equal(args[1], url);
        assert.deepEqual(args[2], {header: 42, 'Bakery-Protocol-Version': 1});
        assert.equal(args[3], body);
        assert.isFunction(args[8]);
        client._sendRequest.reset();
      });
      ['GET', 'delete'].forEach(method => {
        bakery.sendRequest(url, method, headers, callback);
        assert.equal(client._sendRequest.callCount, 1);
        args = client._sendRequest.args[0];
        assert.equal(args[0], method.toLowerCase());
        assert.equal(args[1], url);
        assert.deepEqual(args[2], {header: 42, 'Bakery-Protocol-Version': 1});
        assert.isFunction(args[7]);
        client._sendRequest.reset();
      });
    });

    it('sets the headers', () => {
      bakery.sendRequest('http://example.com/', 'GET', {'foo': 'bar'});
      const expectedHeaders = {
        'Bakery-Protocol-Version': 1,
        'foo': 'bar'
      };
      assert.deepEqual(client._sendRequest.args[0][2], expectedHeaders);
    });

    it('adds macaroons to the request', () => {
      // We add two "macaroons" into the store--one for the url we're setting,
      // one that we should not get.
      fakeLocalStorage.store['charmstore'] = 'doctor';
      fakeLocalStorage.store['identity'] = 'bad wolf';

      bakery.sendRequest('http://example.com/', 'GET');
      const expectedHeaders = {
        'Bakery-Protocol-Version': 1,
        'Macaroons': 'doctor'
      };
      assert.deepEqual(client._sendRequest.args[0][2], expectedHeaders);
    });

    it('wraps callbacks with discharge functionality', () => {
      const wrapper = sinon.stub(bakery, '_wrapCallback');
      bakery.sendRequest('http://example.com/', 'GET');
      assert.equal(wrapper.callCount, 1);
    });
  });

  describe('macaroon discharges', () => {
    let dischargeStub, generateStub;

    beforeEach(() => {
      dischargeStub = sinon.stub(macaroonlib, 'dischargeMacaroon');
      generateStub = sinon.stub(macaroonlib, 'generateMacaroons');
    });

    afterEach(() => {
      dischargeStub.restore();
      generateStub.restore();
    });

    it('discharges macaroons', () => {
      const macaroon = 'this is a macaroon';
      const success = discharges => {
        assert.equal(discharges, macaroon);
      };
      const failure = msg => {
        console.error(msg);
        assert.fail();
      };
      bakery.discharge(macaroon, success, failure);
      assert.equal(
        dischargeStub.callCount, 1,
        'macaroonlib discharge not called');
    });

    it('handles failures discharging macaroons', () => {
      const macaroon = 'this is a macaroon';
      const error = { message: 'bad wolf' };
      dischargeStub.callsArgWith(2, macaroon);
      generateStub.throws(error);
      const success = () => {};
      const failure = msg => {
        assert.equal(msg, `discharge failed: ${error.message}`);
      };
      bakery.discharge('macaroons', success, failure);
    });

    it('handles third party discharge', () => {
      const condition = 'this is a caveat';
      const success = macaroons => {}; 
      const failure = err => {};
      bakery._getThirdPartyDischarge(
        'http://example.com/',
        'http://example.com/identity',
        condition, success, failure);
      assert.equal(client._sendRequest.callCount, 1);
      const args = client._sendRequest.args[0];
      assert.equal(args[0], 'post');
      assert.equal(args[1], 'http://example.com/identity/discharge');
      assert.deepEqual(args[2], {
        'Bakery-Protocol-Version': 1,
        'Content-Type': 'application/x-www-form-urlencoded'
      });
      assert.equal(
        args[3],
        'id=this%20is%20a%20caveat&location=http%3A%2F%2Fexample.com%2F');
    });
  });

  describe('wrapped callbacks', () => {
    const getTarget = responseObj => {
      if (!responseObj) {
        return { status: 200 };
      }
      const responseText = JSON.stringify(responseObj);
      return {
        status: 401,
        getResponseHeader: sinon.stub().returns('application/json'),
        responseText: responseText
      };
    };

    it('handles requests normally if nothing is needed', () => {
      const cb = sinon.stub(); 
      const wrappedCB = bakery._wrapCallback(
        'http://example.com', 'POST', {}, 'body', cb);
      const target = getTarget();
      wrappedCB({ target });
      assert.equal(cb.callCount, 1);
    });

    it('handles interaction if needed', () => {
      const interact = sinon.stub(bakery, '_interact');
      const cb = sinon.stub(); 
      const wrappedCB = bakery._wrapCallback(
        'http://example.com', 'POST', {}, 'body', cb);
      const target = getTarget({
        Code: 'interaction required',
        Info: {
          VisitURL: 'http://example.com/identity',
          WaitURL: 'http://example.com/identity/wait'
        }
      });
      wrappedCB({ target });
      assert.equal(interact.callCount, 1);
      const args = interact.args[0];
      assert.equal(args[0], 'http://example.com/identity');
      assert.equal(args[1], 'http://example.com/identity/wait');
    });

    it('handles discharge if needed', () => {
      const dischargeStub = sinon.stub(bakery, 'discharge');
      const cb = sinon.stub(); 
      const wrappedCB = bakery._wrapCallback(
        'http://example.com', 'POST', {}, 'body', cb);
      const target = getTarget({
        Code: 'macaroon discharge required',
        Info: { Macaroon: 'macaroon' }
      });
      wrappedCB({ target });
      assert.equal(dischargeStub.callCount, 1);
      const args = dischargeStub.args[0];
      assert.equal(args[0], 'macaroon');
    });
  });
});

