import React from 'react';
import {
    ITherapyRecommendation,
    IClinicalTrial,
} from 'shared/model/TherapyRecommendation';
import AsyncCreatableSelect from 'react-select/async-creatable';
import _ from 'lodash';
import request from 'superagent';

interface TherapyRecommendationFormClinicalTrialInputProps {
    data: ITherapyRecommendation;
    onChange: (clinicalTrials: IClinicalTrial[]) => void;
}

type MyOption = { label: string; value: IClinicalTrial };

export default class TherapyRecommendationFormClinicalTrialInput extends React.Component<
    TherapyRecommendationFormClinicalTrialInputProps,
    {}
> {
    public render() {
        const clinicalTrialDefault = this.props.data.clinicalTrials.map(
            (clinicalTrial: IClinicalTrial) => ({
                value: clinicalTrial,
                label: clinicalTrial.id + ': ' + clinicalTrial.name,
            })
        );
        return (
            <AsyncCreatableSelect
                isMulti
                defaultValue={clinicalTrialDefault}
                cacheOptions
                placeholder="Enter or search trial title..."
                name="clinicalTrialsSelect"
                className="creatable-multi-select"
                classNamePrefix="select"
                onChange={(selectedOption: MyOption[]) => {
                    if (Array.isArray(selectedOption)) {
                        this.props.onChange(
                            selectedOption.map(option => {
                                if (_.isString(option.value)) {
                                    return {
                                        id: '',
                                        name: option.value,
                                    } as IClinicalTrial;
                                } else {
                                    return option.value as IClinicalTrial;
                                }
                            })
                        );
                    } else if (selectedOption === null) {
                        this.props.onChange([] as IClinicalTrial[]);
                    }
                }}
                loadOptions={promiseOptions}
            />
        );
    }
}

const promiseOptions = (
    inputValue: string,
    callback: (options: ReadonlyArray<MyOption>) => void
) =>
    new Promise<MyOption>((resolve, reject) => {
        // TODO better to separate this call to a configurable client
        request
            .get(
                'https://www.clinicaltrials.gov/api/query/study_fields?expr=' +
                    inputValue +
                    '&fields=NCTId%2CBriefTitle%2COfficialTitle&min_rnk=1&max_rnk=5&fmt=json'
            )
            .end((err, res) => {
                if (!err && res.ok) {
                    const response = JSON.parse(res.text);
                    const result = response.result;
                    const trialResults = result.StudyFieldResponse.Studyfields;
                    const ret: MyOption[] = trialResults.map(
                        (trialResult: {
                            BriefTitle: string;
                            NCTId: string;
                        }) => {
                            const trialName = trialResult.BriefTitle;
                            const trialId = trialResult.NCTId;
                            return {
                                value: {
                                    name: trialName,
                                    id: trialId,
                                },
                                label: trialId + ': ' + trialName,
                            } as MyOption;
                        }
                    );
                    return callback(ret);
                } else {
                    const errClinicalTrial = {
                        id: '',
                        name: 'Could not fetch trial for: ' + inputValue,
                    };
                    return callback([
                        {
                            value: errClinicalTrial,
                            label:
                                errClinicalTrial.id +
                                ': ' +
                                errClinicalTrial.name,
                        },
                    ]);
                }
            });
    });
