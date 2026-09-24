import test from 'node:test';
import assert from 'node:assert/strict';
import { contentImagePlan, contentImageComposition } from '../src/lib/content-image-plan.ts';

test('hiring articles retain the same practice-specific subject as informational articles', () => {
  for (const [practice, subject] of [
    ['Car Accident', /passenger sedan/],
    ['Truck Accident', /commercial truck/],
    ['Nursing Home Abuse', /long-term care/],
    ['Birth Injury', /clinical environment/],
  ]) {
    const hiring = contentImagePlan(`Best ${practice} Lawyer in Boca Raton FL: What to Look for Before You Hire`);
    assert.match(hiring.scene, subject);
    assert.equal(hiring.scene, contentImagePlan(`${practice} claims`).scene);
    assert.doesNotMatch(hiring.scene, /consultation room/);
  }
});

test('primary practice wins over unrelated examples in body copy', () => {
  assert.match(contentImagePlan('Best Car Accident Lawyer', 'Truck accident evidence, bicycle, pedestrian').scene, /passenger sedan/);
});

test('car composition excludes common sources of logo and plate failures', () => {
  assert.match(contentImagePlan('car accident').scene, /manufacturer emblem and license plate entirely outside the frame/);
});

test('general personal injury pages do not inherit vehicles from body examples', () => {
  for (const city of ['Guttenberg', 'Harrison', 'Bayonne', 'Hudson County']) {
    const plan = contentImagePlan(`${city} NJ Personal Injury Lawyer`, 'car accident truck accident pedestrian insurance claim');
    assert.match(plan.scene, /damaged concrete pedestrian walkway/);
    assert.match(plan.scene, /all vehicles, people.*entirely outside the frame/);
  }
  assert.match(contentImagePlan('Car Accident Personal Injury Lawyer').scene, /passenger sedan/);
  assert.match(contentImagePlan('Truck Accident Personal Injury Lawyer').scene, /commercial truck/);
});

test('composition variations remain subordinate to scene exclusions', () => {
  assert.match(contentImageComposition(contentImagePlan('car accident').scene, 'a wide streetscape'), /camera angle, crop and exclusions first/);
  assert.match(contentImageComposition(contentImagePlan('personal injury').scene, 'a wide streetscape'), /Never widen.*excluded subjects/);
});
