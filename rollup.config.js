import typescript from 'rollup-plugin-typescript2';

export default [
  {
    input: {
      'index': 'src/index.ts',
    },
    output: {
      sourcemap: true,
      exports: 'named',
      format: 'cjs',
      dir: 'dist'
    },
    plugins: [
      typescript()
    ]
  }
];
