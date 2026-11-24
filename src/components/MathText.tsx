import React from "react";
import RichText from './RichText';

export interface MathTextProps {
  text: string;
  className?: string;
  inline?: boolean;
  disableAutoFormat?: boolean;
  enablePronunciation?: boolean;
}

export const MathText: React.FC<MathTextProps> = ({ 
  text, 
  className = '', 
  inline = false,
  enablePronunciation = true 
}) => {
  return <RichText text={text} className={className} inline={inline} enablePronunciation={enablePronunciation} />;
};

export default MathText;
