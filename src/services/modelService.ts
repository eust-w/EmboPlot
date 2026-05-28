import { apiService } from '@/src/services/api';
import type { SceneImageInput } from '@/src/types';

export const modelService = {
  generateImage(prompt: string) {
    return apiService.generateSceneImage(prompt);
  },

  generateImageFromLines(input: SceneImageInput) {
    return apiService.generateImageFromLines(input);
  },

  generateSpeech(text: string, voiceName: string = 'Kore') {
    return apiService.generateSpeech(text, voiceName);
  },
};
