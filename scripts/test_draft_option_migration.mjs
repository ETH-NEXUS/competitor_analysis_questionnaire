import assert from 'node:assert/strict';
import {
  remapV11Selection,
  retiredV11Option,
  v11SourceIndex,
} from '../ui/app/app/utils/draft-option-migration.ts';

assert.equal(remapV11Selection('apiAccess', '5'), '3');
assert.equal(remapV11Selection('apiAccess', '3'), '4');
assert.equal(retiredV11Option('apiAccess', '3'), 'Integrations generally require vendor-specific interfaces or development');
assert.equal(v11SourceIndex('apiAccess', 3), 5);

assert.equal(remapV11Selection('developerIndependence', '3'), '2');
assert.equal(remapV11Selection('developerIndependence', '2'), '3');
assert.equal(v11SourceIndex('developerIndependence', 3), 4);

assert.deepEqual(
  ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']
    .map(index => remapV11Selection('documentationMethods', index)),
  ['7', '7', '0', '7', '1', '2', '3', '4', '5', '6', '7', '8'],
);
assert.equal(retiredV11Option('documentationMethods', '1'), 'Structured documentation templates');
assert.equal(v11SourceIndex('documentationMethods', 5), 8);
assert.equal(remapV11Selection('migration', '2'), '2');
console.log('Draft option migration passed');
