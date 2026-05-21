import { Initiative, Asset, Programme, Dependency, Milestone } from '../types';

export type ValidationErrors = Record<string, string>;

export function validateInitiative(
    init: Initiative,
    assets: Asset[],
    programmes: Programme[]
): ValidationErrors {
    const errors: ValidationErrors = {};

    if (typeof init.name !== 'string' || init.name.trim() === '') {
        errors.name = 'Name is required';
    }

    if (!init.assetId || !assets.some(a => a.id === init.assetId)) {
        errors.assetId = 'Please select a valid asset';
    }

    if (!init.programmeId || !programmes.some(p => p.id === init.programmeId)) {
        errors.programmeId = 'Please select a valid programme';
    }

    if (!init.startDate) {
        errors.startDate = 'Start date is required';
    }

    if (!init.endDate) {
        errors.endDate = 'End date is required';
    }

    if (init.startDate && init.endDate && init.endDate < init.startDate) {
        errors.endDate = 'End date must be on or after start date';
    }

    if (init.capex != null && init.capex < 0) {
        errors.capex = 'CapEx cannot be negative';
    }
    if (init.opex != null && init.opex < 0) {
        errors.opex = 'OpEx cannot be negative';
    }

    return errors;
}

export function validateDependency(
    dep: Dependency,
    initiatives: Initiative[]
): ValidationErrors {
    const errors: ValidationErrors = {};

    if (!dep.sourceId || !initiatives.some(i => i.id === dep.sourceId)) {
        errors.sourceId = 'Please select a valid initiative';
    }

    if (!dep.targetId || !initiatives.some(i => i.id === dep.targetId)) {
        errors.targetId = 'Please select a valid initiative';
    }

    if (dep.sourceId && dep.targetId && dep.sourceId === dep.targetId) {
        errors.targetId = 'Cannot depend on itself';
    }

    return errors;
}

export function validateMilestone(
    mile: Milestone,
    assets: Asset[]
): ValidationErrors {
    const errors: ValidationErrors = {};

    if (!mile.name || mile.name.trim() === '') {
        errors.name = 'Name is required';
    }

    if (!mile.assetId || !assets.some(a => a.id === mile.assetId)) {
        errors.assetId = 'Please select a valid asset';
    }

    if (!mile.date) {
        errors.date = 'Date is required';
    }

    return errors;
}
