import { QR_LOGO_SRC, qrImageUrl } from '../lib/qrImage';

const ScanQr = ({
  data,
  label,
  size = 192,
}: {
  data: string;
  label?: string;
  size?: number;
}) => {
  const logoSize = Math.round(size * 0.22);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="bg-white p-2 border border-gray-200 rounded-lg">
        <div className="relative" style={{ width: size, height: size }}>
          <img
            src={qrImageUrl(data, size)}
            alt={label || 'QR code'}
            width={size}
            height={size}
            className="block"
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="bg-white rounded-md flex items-center justify-center"
              style={{ padding: Math.max(3, Math.round(size * 0.018)) }}
            >
              <img
                src={QR_LOGO_SRC}
                alt=""
                width={logoSize}
                height={logoSize}
                className="rounded-md object-cover"
              />
            </div>
          </div>
        </div>
      </div>
      {label ? <p className="text-xs text-gray-500 text-center">{label}</p> : null}
    </div>
  );
};

export default ScanQr;
