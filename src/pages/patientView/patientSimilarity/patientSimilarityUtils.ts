import {
    SimilarPatient,
    TaggedMutation,
    SimilarMutation,
} from 'shared/api/SimilarPatientsAPI';
import {
    ClinicalData,
    CBioPortalAPI,
    MutationFilter,
    Mutation,
    MolecularProfile,
} from 'cbioportal-ts-api-client';

export function getSimilarMutations(
    mergedMutationData1: Mutation[][],
    mergedMutationData2: Mutation[][]
): SimilarMutation[] {
    var result = [];
    for (const referenceMutations of mergedMutationData1) {
        const referenceMutation = referenceMutations[0];
        var newMutation = {
            mutations1: referenceMutations,
            similarityTag: 'unequal',
        } as SimilarMutation;
        var equalityScore = 0;
        for (const comparingMutations of mergedMutationData2) {
            const comareingMutation = comparingMutations[0];

            // equal variant
            if (
                referenceMutation.chr === comareingMutation.chr &&
                referenceMutation.startPosition ===
                    comareingMutation.startPosition &&
                referenceMutation.referenceAllele ===
                    comareingMutation.referenceAllele &&
                referenceMutation.variantAllele ===
                    comareingMutation.variantAllele &&
                equalityScore < 50
            ) {
                newMutation['similarityTag'] = 'equal';
                newMutation['mutations2'] = comparingMutations;
                equalityScore = 50;
                break;
            }

            // equal phgvs
            if (
                referenceMutation.proteinChange ===
                    comareingMutation.proteinChange &&
                referenceMutation.gene === comareingMutation.gene &&
                equalityScore < 40
            ) {
                newMutation['similarityTag'] = 'phgvs';
                newMutation['mutations2'] = comparingMutations;
                equalityScore = 40;
                continue;
            }

            // equal pathaway

            // equal gene
            if (
                referenceMutation.gene === comareingMutation.gene &&
                equalityScore < 20
            ) {
                newMutation['similarityTag'] = 'gene';
                newMutation['mutations2'] = comparingMutations;
                equalityScore = 20;
                continue;
            }

            // equal GO Term
        }

        if (equalityScore > 0) {
            result.push(newMutation);
        }
    }
    return result;
}

export function filterSimilarMutations(
    similarMutations: SimilarMutation[],
    similarityTags: string[]
): SimilarMutation[] {
    return similarMutations.filter((similarMutation: SimilarMutation) => {
        if (similarityTags.includes(similarMutation.similarityTag)) {
            return similarMutation;
        }
    });
}
