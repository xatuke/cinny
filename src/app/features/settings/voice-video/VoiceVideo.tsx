import React, { useEffect, useState } from 'react';
import { Box, Text, IconButton, Icon, Icons, Scroll, Button } from 'folds';
import { useAtomValue, useSetAtom } from 'jotai';
import { Page, PageContent, PageHeader } from '../../../components/page';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useMediaDevices } from '../../../hooks/useMediaDevices';
import {
  audioInputsAtom,
  videoInputsAtom,
  audioOutputsAtom,
  selectedAudioInputAtom,
  selectedVideoInputAtom,
  selectedAudioOutputAtom,
} from '../../../state/call/mediaDevices';

type VoiceVideoProps = {
  requestClose: () => void;
};

export function VoiceVideo({ requestClose }: VoiceVideoProps) {
  useMediaDevices();

  const audioInputs = useAtomValue(audioInputsAtom);
  const videoInputs = useAtomValue(videoInputsAtom);
  const audioOutputs = useAtomValue(audioOutputsAtom);

  const selectedAudioInput = useAtomValue(selectedAudioInputAtom);
  const selectedVideoInput = useAtomValue(selectedVideoInputAtom);
  const selectedAudioOutput = useAtomValue(selectedAudioOutputAtom);

  const setSelectedAudioInput = useSetAtom(selectedAudioInputAtom);
  const setSelectedVideoInput = useSetAtom(selectedVideoInputAtom);
  const setSelectedAudioOutput = useSetAtom(selectedAudioOutputAtom);

  const [micLevel, setMicLevel] = useState(0);
  const [testingMic, setTestingMic] = useState(false);

  useEffect(() => {
    if (!testingMic) {
      setMicLevel(0);
      return undefined;
    }

    let stream: MediaStream | null = null;
    let animationFrame: number;
    let audioCtx: AudioContext | null = null;

    const startTest = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedAudioInput ? { deviceId: selectedAudioInput } : true,
        });
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const update = () => {
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
          setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
          animationFrame = requestAnimationFrame(update);
        };
        update();
      } catch {
        setTestingMic(false);
      }
    };

    startTest();

    return () => {
      cancelAnimationFrame(animationFrame);
      stream?.getTracks().forEach((t) => t.stop());
      audioCtx?.close();
    };
  }, [testingMic, selectedAudioInput]);

  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" truncate>
              Voice & Video
            </Text>
          </Box>
          <Box shrink="No">
            <IconButton onClick={requestClose} variant="Surface">
              <Icon src={Icons.Cross} />
            </IconButton>
          </Box>
        </Box>
      </PageHeader>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              {/* Audio Input */}
              <Box direction="Column" gap="100">
                <Text size="L400">Audio Input</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                  gap="400"
                >
                  <SettingTile
                    title="Microphone"
                    after={
                      <select
                        value={selectedAudioInput ?? ''}
                        onChange={(e) => setSelectedAudioInput(e.target.value || undefined)}
                        style={{ maxWidth: '200px' }}
                      >
                        <option value="">Default</option>
                        {audioInputs.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    }
                  />
                  <SettingTile
                    title="Test Microphone"
                    after={
                      <Button
                        size="300"
                        variant={testingMic ? 'Critical' : 'Secondary'}
                        fill="Soft"
                        radii="300"
                        onClick={() => setTestingMic((v) => !v)}
                      >
                        <Text size="B300">{testingMic ? 'Stop' : 'Test'}</Text>
                      </Button>
                    }
                  />
                  {testingMic && (
                    <Box gap="200" alignItems="Center">
                      <Icon size="200" src={Icons.Mic} />
                      <Box
                        grow="Yes"
                        style={{
                          height: '8px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--color-surface-variant-container-line)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${micLevel}%`,
                            height: '100%',
                            backgroundColor: 'var(--color-success-main)',
                            transition: 'width 100ms',
                            borderRadius: '4px',
                          }}
                        />
                      </Box>
                    </Box>
                  )}
                </SequenceCard>
              </Box>

              {/* Audio Output */}
              {audioOutputs.length > 0 && (
                <Box direction="Column" gap="100">
                  <Text size="L400">Audio Output</Text>
                  <SequenceCard
                    className={SequenceCardStyle}
                    variant="SurfaceVariant"
                    direction="Column"
                    gap="400"
                  >
                    <SettingTile
                      title="Speaker"
                      after={
                        <select
                          value={selectedAudioOutput ?? ''}
                          onChange={(e) => setSelectedAudioOutput(e.target.value || undefined)}
                          style={{ maxWidth: '200px' }}
                        >
                          <option value="">Default</option>
                          {audioOutputs.map((d) => (
                            <option key={d.deviceId} value={d.deviceId}>
                              {d.label}
                            </option>
                          ))}
                        </select>
                      }
                    />
                  </SequenceCard>
                </Box>
              )}

              {/* Video Input */}
              <Box direction="Column" gap="100">
                <Text size="L400">Video</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                  gap="400"
                >
                  <SettingTile
                    title="Camera"
                    after={
                      <select
                        value={selectedVideoInput ?? ''}
                        onChange={(e) => setSelectedVideoInput(e.target.value || undefined)}
                        style={{ maxWidth: '200px' }}
                      >
                        <option value="">Default</option>
                        {videoInputs.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    }
                  />
                </SequenceCard>
              </Box>
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
