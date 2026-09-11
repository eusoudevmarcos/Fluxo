import { useVideoPlayer, VideoView } from "expo-video";
import type { StyleProp, ViewStyle } from "react-native";

type PostVideoProps = {
  uri: string;
  style?: StyleProp<ViewStyle>;
};

export function PostVideo({ uri, style }: PostVideoProps) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });

  return <VideoView contentFit="cover" nativeControls player={player} style={style} />;
}
