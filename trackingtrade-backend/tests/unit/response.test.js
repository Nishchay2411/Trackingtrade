const { attachResponseHelpers } = require('../../src/utils/response');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('attachResponseHelpers', () => {
  test('attaches success and fail functions to res', () => {
    const res = mockRes();
    attachResponseHelpers({}, res, () => {});
    expect(typeof res.success).toBe('function');
    expect(typeof res.fail).toBe('function');
  });

  test('res.success sends 200 with success:true and merged payload', () => {
    const res = mockRes();
    attachResponseHelpers({}, res, () => {});
    res.success({ trades: [1, 2, 3] }, 'Loaded!');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Loaded!', trades: [1, 2, 3] });
  });

  test('res.success defaults to message "OK" and status 200', () => {
    const res = mockRes();
    attachResponseHelpers({}, res, () => {});
    res.success();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'OK' });
  });

  test('res.fail sends given status code and success:false', () => {
    const res = mockRes();
    attachResponseHelpers({}, res, () => {});
    res.fail('Not found', 404);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Not found' });
  });

  test('res.fail never leaks arbitrary extra keys (only success + message)', () => {
    const res = mockRes();
    attachResponseHelpers({}, res, () => {});
    res.fail('Server error', 500);
    const body = res.json.mock.calls[0][0];
    expect(Object.keys(body).sort()).toEqual(['message', 'success']);
  });

  test('calls next()', () => {
    const next = jest.fn();
    attachResponseHelpers({}, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
